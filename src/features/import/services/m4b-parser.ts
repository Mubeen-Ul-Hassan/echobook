import * as FileSystem from 'expo-file-system/legacy';

// --- Interfaces & Types ---

export interface ParsedChapter {
  title: string;
  startTime: number; // in seconds
  endTime: number; // in seconds
}

export interface ParsedM4bData {
  title: string;
  author: string | null;
  narrator: string | null;
  album: string | null;
  description: string | null;
  genre: string | null;
  year: number | null;
  duration: number; // in seconds
  coverBase64: string | null;
  coverType: string | null; // e.g. 'image/jpeg' | 'image/png'
  chapters: ParsedChapter[];
}

// --- Binary & Base64 Helpers ---

function base64ToBytes(base64: string): Uint8Array {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const lookup = new Uint8Array(256);
  for (let i = 0; i < chars.length; i++) {
    lookup[chars.charCodeAt(i)] = i;
  }

  let bufferLength = base64.length * 0.75;
  if (base64[base64.length - 1] === '=') {
    bufferLength--;
    if (base64[base64.length - 2] === '=') {
      bufferLength--;
    }
  }

  const bytes = new Uint8Array(bufferLength);
  let p = 0;
  for (let i = 0; i < base64.length; i += 4) {
    const b1 = lookup[base64.charCodeAt(i)];
    const b2 = lookup[base64.charCodeAt(i + 1)];
    const b3 = lookup[base64.charCodeAt(i + 2)];
    const b4 = lookup[base64.charCodeAt(i + 3)];

    bytes[p++] = (b1 << 2) | (b2 >> 4);
    if (p < bufferLength) {
      bytes[p++] = ((b2 & 15) << 4) | (b3 >> 2);
    }
    if (p < bufferLength) {
      bytes[p++] = ((b3 & 3) << 6) | (b4 & 63);
    }
  }
  return bytes;
}

function bytesToBase64(bytes: Uint8Array): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let result = '';
  const len = bytes.length;
  for (let i = 0; i < len; i += 3) {
    const b1 = bytes[i];
    const b2 = i + 1 < len ? bytes[i + 1] : 0;
    const b3 = i + 2 < len ? bytes[i + 2] : 0;

    result += chars[b1 >> 2];
    result += chars[((b1 & 3) << 4) | (b2 >> 4)];
    result += i + 1 < len ? chars[((b2 & 15) << 2) | (b3 >> 6)] : '=';
    result += i + 2 < len ? chars[b3 & 63] : '=';
  }
  return result;
}

function detectImageMimeType(bytes: Uint8Array): string | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
  }
  if (
    bytes.length >= 4 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return 'image/png';
  }
  if (
    bytes.length >= 4 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46
  ) {
    return 'image/webp';
  }
  if (bytes.length >= 3 && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) {
    return 'image/gif';
  }
  if (bytes.length >= 2 && bytes[0] === 0x42 && bytes[1] === 0x4d) {
    return 'image/bmp';
  }
  return null;
}

class BinaryReader {
  private bytes: Uint8Array;
  public offset: number;

  constructor(bytes: Uint8Array) {
    this.bytes = bytes;
    this.offset = 0;
  }

  readUint32(): number {
    if (this.offset + 4 > this.bytes.length) return 0;
    const val =
      ((this.bytes[this.offset] << 24) >>> 0) +
      (this.bytes[this.offset + 1] << 16) +
      (this.bytes[this.offset + 2] << 8) +
      this.bytes[this.offset + 3];
    this.offset += 4;
    return val;
  }

  readUint16(): number {
    if (this.offset + 2 > this.bytes.length) return 0;
    const val = (this.bytes[this.offset] << 8) | this.bytes[this.offset + 1];
    this.offset += 2;
    return val;
  }

  readUint8(): number {
    if (this.offset >= this.bytes.length) return 0;
    const val = this.bytes[this.offset];
    this.offset += 1;
    return val;
  }

  readUint64(): number {
    const high = this.readUint32();
    const low = this.readUint32();
    return high * 4294967296 + low;
  }

  readSynchsafeUint32(): number {
    if (this.offset + 4 > this.bytes.length) return 0;
    const b1 = this.bytes[this.offset] & 0x7f;
    const b2 = this.bytes[this.offset + 1] & 0x7f;
    const b3 = this.bytes[this.offset + 2] & 0x7f;
    const b4 = this.bytes[this.offset + 3] & 0x7f;
    this.offset += 4;
    return (b1 << 21) | (b2 << 14) | (b3 << 7) | b4;
  }

  readUtf8String(len: number): string {
    if (this.offset + len > this.bytes.length) {
      len = Math.max(0, this.bytes.length - this.offset);
    }
    const slice = this.bytes.slice(this.offset, this.offset + len);
    this.offset += len;

    try {
      if (typeof TextDecoder !== 'undefined') {
        return new TextDecoder('utf-8').decode(slice).replace(/\0+$/, '').trim();
      }
      let out = '',
        i = 0;
      while (i < slice.length) {
        const c = slice[i++];
        if (c === 0) break;
        if (c < 128) {
          out += String.fromCharCode(c);
        } else if (c > 191 && c < 224) {
          out += String.fromCharCode(((c & 31) << 6) | (slice[i++] & 63));
        } else {
          out += String.fromCharCode(
            ((c & 15) << 12) | ((slice[i++] & 63) << 6) | (slice[i++] & 63)
          );
        }
      }
      return out.trim();
    } catch {
      return '';
    }
  }

  readLatin1String(len: number): string {
    if (this.offset + len > this.bytes.length) {
      len = Math.max(0, this.bytes.length - this.offset);
    }
    let out = '';
    for (let i = 0; i < len; i++) {
      const c = this.bytes[this.offset++];
      if (c === 0) break;
      out += String.fromCharCode(c);
    }
    return out.trim();
  }

  skip(len: number) {
    this.offset += len;
  }

  hasRemaining(len: number = 1): boolean {
    return this.offset + len <= this.bytes.length;
  }

  getBytes(len: number): Uint8Array {
    if (this.offset + len > this.bytes.length) {
      len = Math.max(0, this.bytes.length - this.offset);
    }
    const slice = this.bytes.slice(this.offset, this.offset + len);
    this.offset += len;
    return slice;
  }
}

// --- File Reading Helpers ---

async function readBytesAt(fileUri: string, position: number, length: number): Promise<Uint8Array> {
  try {
    const base64 = await FileSystem.readAsStringAsync(fileUri, {
      encoding: FileSystem.EncodingType.Base64,
      position,
      length,
    });
    return base64ToBytes(base64);
  } catch {
    return new Uint8Array(0);
  }
}

// --- MP4 / M4B Atom Parsing ---

interface AtomHeader {
  size: number;
  type: string;
  headerSize: number;
  position?: number;
}

async function readAtomHeader(fileUri: string, position: number): Promise<AtomHeader | null> {
  const bytes = await readBytesAt(fileUri, position, 8);
  if (bytes.length < 8) return null;

  let size =
    ((bytes[0] << 24) >>> 0) + (bytes[1] << 16) + (bytes[2] << 8) + bytes[3];
  const type = String.fromCharCode(bytes[4], bytes[5], bytes[6], bytes[7]);
  let headerSize = 8;

  if (size === 1) {
    // 64-bit size
    const extBytes = await readBytesAt(fileUri, position + 8, 8);
    if (extBytes.length === 8) {
      const high =
        ((extBytes[0] << 24) >>> 0) +
        (extBytes[1] << 16) +
        (extBytes[2] << 8) +
        extBytes[3];
      const low =
        ((extBytes[4] << 24) >>> 0) +
        (extBytes[5] << 16) +
        (extBytes[6] << 8) +
        extBytes[7];
      size = high * 4294967296 + low;
      headerSize = 16;
    }
  }

  if (size < headerSize && size !== 0) return null;
  return { size, type, headerSize };
}

async function parseChplBox(
  fileUri: string,
  position: number,
  size: number,
  headerSize: number
): Promise<Omit<ParsedChapter, 'endTime'>[]> {
  try {
    const bytes = await readBytesAt(fileUri, position + headerSize, Math.min(size - headerSize, 2097152));
    if (bytes.length < 5) return [];
    const reader = new BinaryReader(bytes);

    // Nero "chpl" atom layout (matches what ffmpeg/mp4box/m4b-tool write & read):
    //   uint8  version
    //   uint24 flags
    //   uint32 reserved   <- only present when version != 0 (ffmpeg always writes version=1)
    //   uint8  chapterCount
    //   per chapter: uint64 startTime (100ns units), uint8 titleLen, char[titleLen] title
    const version = reader.readUint8();
    reader.skip(3); // flags
    if (version !== 0) {
      reader.skip(4); // reserved 32-bit field
    }

    const chapterCount = reader.readUint8();

    if (chapterCount <= 0) return [];

    const chapters: Omit<ParsedChapter, 'endTime'>[] = [];
    for (let i = 0; i < chapterCount; i++) {
      if (!reader.hasRemaining(9)) break;
      const startTimeUnits = reader.readUint64();
      const startTime = startTimeUnits / 10000000; // 100-ns units to seconds
      const titleLen = reader.readUint8();

      if (!reader.hasRemaining(titleLen)) break;
      const rawTitle = reader.readUtf8String(titleLen) || `Chapter ${i + 1}`;
      const title = rawTitle.replace(/^\uFEFF/, '').trim() || `Chapter ${i + 1}`;
      chapters.push({ title, startTime });
    }

    return chapters;
  } catch {
    return [];
  }
}

interface StscEntry {
  firstChunk: number;
  samplesPerChunk: number;
  sampleDescriptionIndex: number;
}

async function parseQuickTimeChapters(
  fileUri: string,
  moovPosition: number,
  moovSize: number,
  moovHeaderSize: number
): Promise<ParsedChapter[]> {
  try {
    const moovEnd = moovPosition + moovSize;
    let pos = moovPosition + moovHeaderSize;

    let chapterTrackId: number | null = null;
    interface TrackInfo {
      position: number;
      size: number;
      headerSize: number;
      trackId: number;
      handlerType: string;
    }
    const tracks: TrackInfo[] = [];

    // Scan tracks inside moov
    while (pos < moovEnd) {
      const header = await readAtomHeader(fileUri, pos);
      if (!header || header.size === 0) break;

      if (header.type === 'trak') {
        const trakEnd = pos + header.size;
        let subPos = pos + header.headerSize;
        let tkhdId = 0;
        let handlerType = '';

        while (subPos < trakEnd) {
          const subHeader = await readAtomHeader(fileUri, subPos);
          if (!subHeader || subHeader.size === 0) break;

          if (subHeader.type === 'tkhd') {
            const tkhdBytes = await readBytesAt(fileUri, subPos + subHeader.headerSize, 24);
            if (tkhdBytes.length >= 24) {
              const version = tkhdBytes[0];
              tkhdId = version === 1
                ? ((tkhdBytes[20] << 24) >>> 0) + (tkhdBytes[21] << 16) + (tkhdBytes[22] << 8) + tkhdBytes[23]
                : ((tkhdBytes[12] << 24) >>> 0) + (tkhdBytes[13] << 16) + (tkhdBytes[14] << 8) + tkhdBytes[15];
            }
          } else if (subHeader.type === 'tref') {
            // Check for chap reference
            const trefEnd = subPos + subHeader.size;
            let refPos = subPos + subHeader.headerSize;
            while (refPos < trefEnd) {
              const refHeader = await readAtomHeader(fileUri, refPos);
              if (!refHeader || refHeader.size === 0) break;
              if (refHeader.type === 'chap') {
                const chapBytes = await readBytesAt(fileUri, refPos + refHeader.headerSize, 4);
                if (chapBytes.length >= 4) {
                  chapterTrackId = ((chapBytes[0] << 24) >>> 0) + (chapBytes[1] << 16) + (chapBytes[2] << 8) + chapBytes[3];
                }
              }
              refPos += refHeader.size;
            }
          } else if (subHeader.type === 'mdia') {
            const mdiaEnd = subPos + subHeader.size;
            let mdiaPos = subPos + subHeader.headerSize;
            while (mdiaPos < mdiaEnd) {
              const mHeader = await readAtomHeader(fileUri, mdiaPos);
              if (!mHeader || mHeader.size === 0) break;
              if (mHeader.type === 'hdlr') {
                const hdlrBytes = await readBytesAt(fileUri, mdiaPos + mHeader.headerSize, 16);
                if (hdlrBytes.length >= 12) {
                  handlerType = String.fromCharCode(hdlrBytes[8], hdlrBytes[9], hdlrBytes[10], hdlrBytes[11]);
                }
              }
              mdiaPos += mHeader.size;
            }
          }
          subPos += subHeader.size;
        }

        tracks.push({
          position: pos,
          size: header.size,
          headerSize: header.headerSize,
          trackId: tkhdId,
          handlerType,
        });
      }
      pos += header.size;
    }

    // Find the chapter track
    let targetTrack = tracks.find((t) => chapterTrackId !== null && t.trackId === chapterTrackId);
    if (!targetTrack) {
      targetTrack = tracks.find((t) =>
        ['text', 'subt', 'sbtl', 'tx3g'].includes(t.handlerType.toLowerCase())
      );
    }

    if (!targetTrack) return [];

    // Parse the chapter track's sample table
    let timescale = 1000;
    const sampleDeltas: number[] = [];
    const sampleSizes: number[] = [];
    const chunkOffsets: number[] = [];
    const stscEntries: StscEntry[] = [];

    async function findAndParseStbl(containerPos: number, containerSize: number, containerHeaderSize: number) {
      const end = containerPos + containerSize;
      let p = containerPos + containerHeaderSize;
      while (p < end) {
        const h = await readAtomHeader(fileUri, p);
        if (!h || h.size === 0) break;

        if (h.type === 'mdhd') {
          const mdhdBytes = await readBytesAt(fileUri, p + h.headerSize, 32);
          if (mdhdBytes.length >= 20) {
            const version = mdhdBytes[0];
            const r = new BinaryReader(mdhdBytes);
            r.skip(1); // version
            r.skip(3); // flags
            if (version === 1) {
              r.skip(16); // creation/modification times
              timescale = r.readUint32();
            } else {
              r.skip(8);
              timescale = r.readUint32();
            }
          }
        } else if (h.type === 'stts') {
          const sttsBytes = await readBytesAt(fileUri, p + h.headerSize, Math.min(h.size - h.headerSize, 2097152));
          if (sttsBytes.length >= 8) {
            const r = new BinaryReader(sttsBytes);
            r.skip(4); // version & flags
            const count = r.readUint32();
            for (let i = 0; i < count; i++) {
              if (!r.hasRemaining(8)) break;
              const sampleCount = r.readUint32();
              const sampleDelta = r.readUint32();
              for (let sc = 0; sc < sampleCount; sc++) {
                sampleDeltas.push(sampleDelta);
              }
            }
          }
        } else if (h.type === 'stsz') {
          const stszBytes = await readBytesAt(fileUri, p + h.headerSize, Math.min(h.size - h.headerSize, 2097152));
          if (stszBytes.length >= 12) {
            const r = new BinaryReader(stszBytes);
            r.skip(4); // version & flags
            const defaultSize = r.readUint32();
            const count = r.readUint32();
            if (defaultSize > 0) {
              for (let i = 0; i < count; i++) sampleSizes.push(defaultSize);
            } else {
              for (let i = 0; i < count; i++) {
                if (!r.hasRemaining(4)) break;
                sampleSizes.push(r.readUint32());
              }
            }
          }
        } else if (h.type === 'stsc') {
          const stscBytes = await readBytesAt(fileUri, p + h.headerSize, Math.min(h.size - h.headerSize, 2097152));
          if (stscBytes.length >= 8) {
            const r = new BinaryReader(stscBytes);
            r.skip(4); // version & flags
            const count = r.readUint32();
            for (let i = 0; i < count; i++) {
              if (!r.hasRemaining(12)) break;
              const firstChunk = r.readUint32();
              const samplesPerChunk = r.readUint32();
              const sampleDescriptionIndex = r.readUint32();
              stscEntries.push({ firstChunk, samplesPerChunk, sampleDescriptionIndex });
            }
          }
        } else if (h.type === 'stco') {
          const stcoBytes = await readBytesAt(fileUri, p + h.headerSize, Math.min(h.size - h.headerSize, 2097152));
          if (stcoBytes.length >= 8) {
            const r = new BinaryReader(stcoBytes);
            r.skip(4);
            const count = r.readUint32();
            for (let i = 0; i < count; i++) {
              if (!r.hasRemaining(4)) break;
              chunkOffsets.push(r.readUint32());
            }
          }
        } else if (h.type === 'co64') {
          const co64Bytes = await readBytesAt(fileUri, p + h.headerSize, Math.min(h.size - h.headerSize, 2097152));
          if (co64Bytes.length >= 8) {
            const r = new BinaryReader(co64Bytes);
            r.skip(4);
            const count = r.readUint32();
            for (let i = 0; i < count; i++) {
              if (!r.hasRemaining(8)) break;
              chunkOffsets.push(r.readUint64());
            }
          }
        } else if (['mdia', 'minf', 'stbl'].includes(h.type)) {
          await findAndParseStbl(p, h.size, h.headerSize);
        }
        p += h.size;
      }
    }

    await findAndParseStbl(targetTrack.position, targetTrack.size, targetTrack.headerSize);

    // Build sampleOffsets using stsc mapping
    const sampleOffsets: number[] = [];
    let currentSampleIndex = 0;

    for (let chunkIdx = 0; chunkIdx < chunkOffsets.length; chunkIdx++) {
      const chunkNumber = chunkIdx + 1;
      let samplesInThisChunk = 1;

      for (let s = stscEntries.length - 1; s >= 0; s--) {
        if (chunkNumber >= stscEntries[s].firstChunk) {
          samplesInThisChunk = stscEntries[s].samplesPerChunk;
          break;
        }
      }

      let currentOffsetInChunk = chunkOffsets[chunkIdx];
      for (let sInChunk = 0; sInChunk < samplesInThisChunk; sInChunk++) {
        sampleOffsets.push(currentOffsetInChunk);
        const sz = sampleSizes[currentSampleIndex] ?? sampleSizes[0] ?? 64;
        currentOffsetInChunk += sz;
        currentSampleIndex++;
      }
    }

    if (sampleDeltas.length === 0 || sampleOffsets.length === 0 || timescale <= 0) return [];

    const chapters: ParsedChapter[] = [];
    let currentTimeUnits = 0;
    const totalSamples = Math.min(sampleDeltas.length, sampleOffsets.length);

    for (let i = 0; i < totalSamples; i++) {
      const startTime = currentTimeUnits / timescale;
      const durationUnits = sampleDeltas[i];
      currentTimeUnits += durationUnits;
      const endTime = currentTimeUnits / timescale;

      const offset = sampleOffsets[i];
      const sz = sampleSizes[i] || 64;

      let title = `Chapter ${i + 1}`;
      if (sz > 2) {
        const sampleBytes = await readBytesAt(fileUri, offset, Math.min(sz, 4096));
        if (sampleBytes.length > 2) {
          const r = new BinaryReader(sampleBytes);
          const strLen = r.readUint16();
          if (strLen > 0 && strLen <= sampleBytes.length - 2) {
            title = r.readUtf8String(strLen);
          } else {
            r.offset = 0;
            title = r.readUtf8String(sampleBytes.length);
          }
          title = title
            .replace(/^\uFEFF/, '')
            .replace(/[\x00-\x1F\x7F-\x9F]/g, ' ')
            .trim();
        }
      }

      chapters.push({ title: title || `Chapter ${i + 1}`, startTime, endTime });
    }

    return chapters;
  } catch {
    return [];
  }
}

// --- Searching Metadata & Artwork in MP4 ---

async function searchAtomInMoov(
  fileUri: string,
  startPos: number,
  size: number,
  headerSize: number,
  targetType: string,
  depth: number = 0
): Promise<AtomHeader | null> {
  if (depth > 5) return null;
  const end = startPos + size;
  let pos = startPos + headerSize;

  while (pos < end) {
    const header = await readAtomHeader(fileUri, pos);
    if (!header || header.size === 0 || header.size > end - pos) break;

    if (header.type === targetType) {
      return { ...header, position: pos };
    }

    if (['udta', 'meta', 'moov', 'trak'].includes(header.type)) {
      // In ISO BMFF / QuickTime, 'meta' is a FullBox (header + 4 bytes version/flags)
      const subHeaderSize = header.type === 'meta' ? header.headerSize + 4 : header.headerSize;
      const res = await searchAtomInMoov(fileUri, pos, header.size, subHeaderSize, targetType, depth + 1);
      if (res) return res;
    }

    pos += header.size;
  }
  return null;
}

// --- MP3 ID3v2 Parsing ---

async function parseId3v2Metadata(fileUri: string): Promise<ParsedM4bData | null> {
  try {
    const headerBytes = await readBytesAt(fileUri, 0, 10);
    if (headerBytes.length < 10) return null;

    if (
      headerBytes[0] !== 0x49 || // 'I'
      headerBytes[1] !== 0x44 || // 'D'
      headerBytes[2] !== 0x33 // '3'
    ) {
      return null;
    }

    const versionMajor = headerBytes[3];
    const rHeader = new BinaryReader(headerBytes);
    rHeader.skip(6);
    const tagSize = rHeader.readSynchsafeUint32();

    if (tagSize <= 0) return null;

    const tagBytes = await readBytesAt(fileUri, 10, Math.min(tagSize, 2097152));
    if (tagBytes.length === 0) return null;

    const reader = new BinaryReader(tagBytes);

    const result: ParsedM4bData = {
      title: '',
      author: null,
      narrator: null,
      album: null,
      description: null,
      genre: null,
      year: null,
      duration: 0,
      coverBase64: null,
      coverType: null,
      chapters: [],
    };

    const chapterList: Omit<ParsedChapter, 'endTime'>[] = [];

    while (reader.hasRemaining(10)) {
      let frameId = '';
      let frameSize = 0;

      if (versionMajor === 2) {
        frameId = reader.readLatin1String(3);
        if (!frameId || frameId.charCodeAt(0) === 0) break;
        const b1 = reader.readUint8();
        const b2 = reader.readUint8();
        const b3 = reader.readUint8();
        frameSize = (b1 << 16) | (b2 << 8) | b3;
      } else {
        frameId = reader.readLatin1String(4);
        if (!frameId || frameId.charCodeAt(0) === 0) break;
        frameSize = versionMajor === 4 ? reader.readSynchsafeUint32() : reader.readUint32();
        reader.skip(2); // flags
      }

      if (frameSize <= 0 || !reader.hasRemaining(frameSize)) break;

      const framePayload = reader.getBytes(frameSize);
      if (framePayload.length === 0) continue;

      const frameReader = new BinaryReader(framePayload);

      // Extract Cover Artwork (APIC / PIC)
      if (frameId === 'APIC' || frameId === 'PIC') {
        const encoding = frameReader.readUint8();
        let mimeType = 'image/jpeg';
        if (versionMajor === 2) {
          const format = frameReader.readLatin1String(3).toLowerCase();
          mimeType = format === 'png' ? 'image/png' : 'image/jpeg';
        } else {
          mimeType = frameReader.readLatin1String(64) || 'image/jpeg';
        }

        frameReader.readUint8(); // picture type
        if (encoding === 1 || encoding === 2) {
          while (frameReader.hasRemaining(2)) {
            const u1 = frameReader.readUint8();
            const u2 = frameReader.readUint8();
            if (u1 === 0 && u2 === 0) break;
          }
        } else {
          while (frameReader.hasRemaining(1)) {
            if (frameReader.readUint8() === 0) break;
          }
        }

        const imgBytes = frameReader.getBytes(framePayload.length - frameReader.offset);
        if (imgBytes.length > 0) {
          const detectedMime = detectImageMimeType(imgBytes) || mimeType;
          result.coverBase64 = bytesToBase64(imgBytes);
          result.coverType = detectedMime;
        }
      }
      // Extract Chapter Frames (CHAP)
      else if (frameId === 'CHAP') {
        frameReader.readLatin1String(64); // elementId
        const startTimeMs = frameReader.readUint32();
        const endTimeMs = frameReader.readUint32();
        frameReader.skip(8); // start & end byte offsets

        let chapterTitle = `Chapter ${chapterList.length + 1}`;

        while (frameReader.hasRemaining(10)) {
          const subId = frameReader.readLatin1String(4);
          if (!subId || subId.charCodeAt(0) === 0) break;
          const subSize = versionMajor === 4 ? frameReader.readSynchsafeUint32() : frameReader.readUint32();
          frameReader.skip(2);
          if (subSize <= 0 || !frameReader.hasRemaining(subSize)) break;

          const subBytes = frameReader.getBytes(subSize);
          if (subId === 'TIT2' && subBytes.length > 1) {
            const subR = new BinaryReader(subBytes);
            subR.readUint8(); // encoding
            chapterTitle = subR.readUtf8String(subBytes.length - 1);
          }
        }

        chapterList.push({
          title: chapterTitle || `Chapter ${chapterList.length + 1}`,
          startTime: startTimeMs / 1000,
        });
      }
      // Text metadata frames
      else if (['TIT2', 'TT2'].includes(frameId)) {
        frameReader.readUint8();
        result.title = frameReader.readUtf8String(framePayload.length - 1);
      } else if (['TPE1', 'TP1'].includes(frameId)) {
        frameReader.readUint8();
        result.author = frameReader.readUtf8String(framePayload.length - 1);
      } else if (['TCOM', 'TEXT', 'TMC'].includes(frameId)) {
        frameReader.readUint8();
        result.narrator = frameReader.readUtf8String(framePayload.length - 1);
      } else if (['TALB', 'TAL'].includes(frameId)) {
        frameReader.readUint8();
        result.album = frameReader.readUtf8String(framePayload.length - 1);
      } else if (['TCON', 'TCO'].includes(frameId)) {
        frameReader.readUint8();
        result.genre = frameReader.readUtf8String(framePayload.length - 1);
      } else if (['TYER', 'TDRC', 'TYE'].includes(frameId)) {
        frameReader.readUint8();
        const yrStr = frameReader.readLatin1String(framePayload.length - 1);
        const match = yrStr.match(/\d{4}/);
        if (match) result.year = parseInt(match[0], 10);
      }
    }

    if (chapterList.length > 0) {
      chapterList.sort((a, b) => a.startTime - b.startTime);
      const chapters: ParsedChapter[] = [];
      for (let i = 0; i < chapterList.length; i++) {
        const endTime = i < chapterList.length - 1 ? chapterList[i + 1].startTime : result.duration;
        chapters.push({
          title: chapterList[i].title,
          startTime: chapterList[i].startTime,
          endTime: Math.max(endTime, chapterList[i].startTime + 1),
        });
      }
      result.chapters = chapters;
    }

    return result;
  } catch {
    return null;
  }
}

// --- Main Parser Function ---

export async function parseM4bMetadata(fileUri: string, fallbackFileName?: string): Promise<ParsedM4bData> {
  const result: ParsedM4bData = {
    title: '',
    author: null,
    narrator: null,
    album: null,
    description: null,
    genre: null,
    year: null,
    duration: 0,
    coverBase64: null,
    coverType: null,
    chapters: [],
  };

  try {
    const fileInfo = await FileSystem.getInfoAsync(fileUri);
    if (!fileInfo.exists) {
      throw new Error(`File does not exist: ${fileUri}`);
    }

    const fileSize = fileInfo.size;

    // Check for MP3 ID3v2 tags first
    const id3Result = await parseId3v2Metadata(fileUri);
    if (id3Result) {
      if (id3Result.title) result.title = id3Result.title;
      if (id3Result.author) result.author = id3Result.author;
      if (id3Result.album) result.album = id3Result.album;
      if (id3Result.genre) result.genre = id3Result.genre;
      if (id3Result.year) result.year = id3Result.year;
      if (id3Result.coverBase64) {
        result.coverBase64 = id3Result.coverBase64;
        result.coverType = id3Result.coverType;
      }
      if (id3Result.chapters.length > 0) {
        result.chapters = id3Result.chapters;
      }
    }

    // Attempt MP4 / M4B Box traversal
    let pos = 0;
    let moovHeader: AtomHeader | null = null;

    while (pos < fileSize) {
      const header = await readAtomHeader(fileUri, pos);
      if (!header || header.size === 0) break;

      if (header.type === 'moov') {
        moovHeader = header;
        moovHeader.position = pos;
        break;
      }

      pos += header.size;
    }

    // Fallback: If forward scanning failed to locate 'moov' (e.g. 3 GB file with large mdat), scan backwards from end of file
    if (!moovHeader && fileSize > 1024 * 1024) {
      const searchStart = Math.max(0, fileSize - 64 * 1024 * 1024);
      let chunkPos = fileSize - 65536;
      while (chunkPos >= searchStart && !moovHeader) {
        const chunk = await readBytesAt(fileUri, chunkPos, 65536);
        for (let i = 0; i < chunk.length - 8; i++) {
          if (
            chunk[i + 4] === 0x6d && // 'm'
            chunk[i + 5] === 0x6f && // 'o'
            chunk[i + 6] === 0x6f && // 'o'
            chunk[i + 7] === 0x76    // 'v'
          ) {
            const absolutePos = chunkPos + i;
            const h = await readAtomHeader(fileUri, absolutePos);
            if (h && h.type === 'moov') {
              moovHeader = h;
              moovHeader.position = absolutePos;
              break;
            }
          }
        }
        chunkPos -= 65000;
      }
    }

    if (moovHeader) {
      const moovPosition = moovHeader.position ?? pos;

      // Extract Duration from mvhd
      const moovEnd = moovPosition + moovHeader.size;
      let mPos = moovPosition + moovHeader.headerSize;

      while (mPos < moovEnd) {
        const h = await readAtomHeader(fileUri, mPos);
        if (!h || h.size === 0) break;

        if (h.type === 'mvhd') {
          const mvhdBytes = await readBytesAt(fileUri, mPos + h.headerSize, 32);
          if (mvhdBytes.length >= 20) {
            const version = mvhdBytes[0];
            const r = new BinaryReader(mvhdBytes);
            r.skip(1);
            r.skip(3);
            if (version === 1) {
              r.skip(16);
              const timescale = r.readUint32();
              const dur = r.readUint64();
              if (timescale > 0) result.duration = dur / timescale;
            } else {
              r.skip(8);
              const timescale = r.readUint32();
              const dur = r.readUint32();
              if (timescale > 0) result.duration = dur / timescale;
            }
          }
        }
        mPos += h.size;
      }

      // 1. Nero chpl chapter extraction (iTunes / OpenAudible / mp4chaps)
      const chplHeader = await searchAtomInMoov(
        fileUri,
        moovPosition,
        moovHeader.size,
        moovHeader.headerSize,
        'chpl'
      );
      if (chplHeader && chplHeader.position !== undefined) {
        const tempChapters = await parseChplBox(
          fileUri,
          chplHeader.position,
          chplHeader.size,
          chplHeader.headerSize
        );
        if (tempChapters.length > 0) {
          const chapters: ParsedChapter[] = [];
          for (let i = 0; i < tempChapters.length; i++) {
            const endTime = i < tempChapters.length - 1
              ? tempChapters[i + 1].startTime
              : result.duration;
            chapters.push({
              title: tempChapters[i].title,
              startTime: tempChapters[i].startTime,
              endTime: Math.max(endTime, tempChapters[i].startTime + 1),
            });
          }
          result.chapters = chapters;
        }
      }

      // 2. QuickTime chapter track extraction fallback
      if (result.chapters.length === 0) {
        const qtChapters = await parseQuickTimeChapters(
          fileUri,
          moovPosition,
          moovHeader.size,
          moovHeader.headerSize
        );
        if (qtChapters.length > 0) {
          result.chapters = qtChapters;
        }
      }

      // Search for iTunes ilst metadata & cover
      const ilstHeader = await searchAtomInMoov(
        fileUri,
        moovPosition,
        moovHeader.size,
        moovHeader.headerSize,
        'ilst'
      );

      if (ilstHeader && ilstHeader.position !== undefined) {
        const ilstEnd = ilstHeader.position + ilstHeader.size;
        let tagPos = ilstHeader.position + ilstHeader.headerSize;

        while (tagPos < ilstEnd) {
          const keyHeader = await readAtomHeader(fileUri, tagPos);
          if (!keyHeader || keyHeader.size === 0 || keyHeader.size > ilstEnd - tagPos) break;

          const keyEnd = tagPos + keyHeader.size;
          let subPos = tagPos + keyHeader.headerSize;

          while (subPos < keyEnd) {
            const subHeader = await readAtomHeader(fileUri, subPos);
            if (!subHeader || subHeader.size === 0 || subHeader.size > keyEnd - subPos) break;

            if (subHeader.type === 'data') {
              const dataBytes = await readBytesAt(
                fileUri,
                subPos + subHeader.headerSize,
                Math.min(subHeader.size - subHeader.headerSize, 2097152)
              );

              if (dataBytes.length > 8) {
                const key = keyHeader.type;
                const typeFlag = dataBytes[3];

                if (key === 'covr' || typeFlag === 13 || typeFlag === 14) {
                  const imgPayload = dataBytes.slice(8);
                  const mime = detectImageMimeType(imgPayload) || 'image/jpeg';
                  result.coverBase64 = bytesToBase64(imgPayload);
                  result.coverType = mime;
                } else if (typeFlag === 1 || typeFlag === 0 || typeFlag === 21) {
                  const rData = new BinaryReader(dataBytes);
                  rData.skip(8);
                  const text = rData.readUtf8String(dataBytes.length - 8);

                  const normKey = key.replace(/[\xA9\xA9\u00A9]/g, '©');
                  if (['©nam', 'nam', 'TITLE', 'title'].includes(normKey) || key.includes('nam')) {
                    if (text) result.title = text;
                  } else if (['©ART', '©art', 'ART', 'art', 'ARTIST', 'artist'].includes(normKey) || key.includes('ART') || key.includes('art')) {
                    if (text) result.author = text;
                  } else if (['©wrt', 'wrt', 'COMPOSER', 'composer', 'NARRATOR', 'narrator', '©nrt'].includes(normKey) || key.includes('wrt') || key.includes('nrt')) {
                    if (text) result.narrator = text;
                  } else if (['©alb', '©ALB', 'alb', 'ALBUM', 'album'].includes(normKey) || key.includes('alb')) {
                    if (text) result.album = text;
                  } else if (['©des', 'desc', 'DESCRIPTION', 'description'].includes(normKey) || key.includes('des')) {
                    if (text) result.description = text;
                  } else if (['©gen', 'genre', 'GENRE'].includes(normKey) || key.includes('gen')) {
                    if (text) result.genre = text;
                  } else if (['©day', 'year', 'DATE', 'date'].includes(normKey) || key.includes('day')) {
                    const match = text.match(/\d{4}/);
                    if (match) result.year = parseInt(match[0], 10);
                  }
                }
              }
              break;
            }
            subPos += subHeader.size;
          }
          tagPos += keyHeader.size;
        }
      }
    }
  } catch (error) {
    console.error('Error parsing audio metadata:', error);
  }

  // Fallback title if empty or if it contains raw content URI strings
  const isInvalidTitle =
    !result.title ||
    result.title.startsWith('content:') ||
    result.title.startsWith('file:') ||
    result.title.includes('%3A') ||
    result.title.includes('%2F');

  if (isInvalidTitle) {
    if (fallbackFileName) {
      result.title = fallbackFileName.includes('.')
        ? fallbackFileName.substring(0, fallbackFileName.lastIndexOf('.'))
        : fallbackFileName;
    } else {
      const rawName = decodeURIComponent(fileUri.substring(fileUri.lastIndexOf('/') + 1));
      result.title = rawName.includes('.') ? rawName.substring(0, rawName.lastIndexOf('.')) : rawName;
    }
  }

  // Fallback auto-segmentation ONLY if no chapters were found at all
  if (result.chapters.length === 0) {
    result.chapters = autoSegmentChapters(result.duration);
  }

  return result;
}

export function autoSegmentChapters(duration: number): ParsedChapter[] {
  if (duration <= 0) {
    return [{ title: 'Chapter 1', startTime: 0, endTime: 3600 }];
  }

  const SEGMENT_DURATION = 900; // 15 minutes per chapter
  if (duration <= 600) {
    return [{ title: 'Chapter 1', startTime: 0, endTime: duration }];
  }

  const chapters: ParsedChapter[] = [];
  let currentTime = 0;
  let chapterIndex = 1;

  while (currentTime < duration) {
    const nextTime = Math.min(duration, currentTime + SEGMENT_DURATION);
    const remaining = duration - nextTime;
    const finalEndTime = remaining < 120 ? duration : nextTime;

    chapters.push({
      title: `Chapter ${chapterIndex}`,
      startTime: currentTime,
      endTime: finalEndTime,
    });

    currentTime = finalEndTime;
    chapterIndex++;
  }

  return chapters;
}
