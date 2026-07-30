import * as FileSystem from 'expo-file-system/legacy';

// --- Base64 to Binary Decoders ---

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
    const base64code1 = lookup[base64.charCodeAt(i)];
    const base64code2 = lookup[base64.charCodeAt(i + 1)];
    const base64code3 = lookup[base64.charCodeAt(i + 2)];
    const base64code4 = lookup[base64.charCodeAt(i + 3)];
    
    bytes[p++] = (base64code1 << 2) | (base64code2 >> 4);
    if (p < bufferLength) {
      bytes[p++] = ((base64code2 & 15) << 4) | (base64code3 >> 2);
    }
    if (p < bufferLength) {
      bytes[p++] = ((base64code3 & 3) << 6) | (base64code4 & 63);
    }
  }
  return bytes;
}

// --- Binary Reader Helper ---

class BinaryReader {
  private bytes: Uint8Array;
  private offset: number;

  constructor(bytes: Uint8Array) {
    this.bytes = bytes;
    this.offset = 0;
  }

  readUint32(): number {
    if (this.offset + 4 > this.bytes.length) return 0;
    const val = (this.bytes[this.offset] << 24) |
                (this.bytes[this.offset + 1] << 16) |
                (this.bytes[this.offset + 2] << 8) |
                this.bytes[this.offset + 3];
    this.offset += 4;
    return val >>> 0;
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

  readUtf8String(len: number): string {
    if (this.offset + len > this.bytes.length) {
      len = this.bytes.length - this.offset;
    }
    const slice = this.bytes.slice(this.offset, this.offset + len);
    this.offset += len;
    
    try {
      if (typeof TextDecoder !== 'undefined') {
        return new TextDecoder('utf-8').decode(slice);
      }
      // Simple fallback for environments without TextDecoder
      let out = '', i = 0;
      while (i < slice.length) {
        const c = slice[i++];
        if (c < 128) {
          out += String.fromCharCode(c);
        } else if (c > 191 && c < 224) {
          out += String.fromCharCode(((c & 31) << 6) | (slice[i++] & 63));
        } else {
          out += String.fromCharCode(((c & 15) << 12) | ((slice[i++] & 63) << 6) | (slice[i++] & 63));
        }
      }
      return out;
    } catch {
      return '';
    }
  }

  skip(len: number) {
    this.offset += len;
  }

  hasRemaining(len: number = 1): boolean {
    return this.offset + len <= this.bytes.length;
  }
}

// --- MP4 Box Parsing Helpers ---

export interface ParsedChapter {
  title: string;
  startTime: number; // seconds
  endTime: number; // seconds
}

export interface ParsedM4bData {
  title: string;
  author: string | null;
  album: string | null;
  description: string | null;
  genre: string | null;
  year: number | null;
  duration: number; // seconds
  coverBase64: string | null;
  coverType: string | null; // 'image/jpeg' | 'image/png'
  chapters: ParsedChapter[];
}

async function readAtomHeader(fileUri: string, position: number): Promise<{ size: number; type: string; headerSize: number } | null> {
  try {
    const base64 = await FileSystem.readAsStringAsync(fileUri, {
      encoding: FileSystem.EncodingType.Base64,
      position,
      length: 8,
    });
    
    const bytes = base64ToBytes(base64);
    if (bytes.length < 8) return null;
    
    const size = (bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3];
    const type = String.fromCharCode(bytes[4], bytes[5], bytes[6], bytes[7]);
    
    let headerSize = 8;
    let actualSize = size >>> 0;
    
    if (actualSize === 1) {
      // 64-bit size
      const extBase64 = await FileSystem.readAsStringAsync(fileUri, {
        encoding: FileSystem.EncodingType.Base64,
        position: position + 8,
        length: 8,
      });
      const extBytes = base64ToBytes(extBase64);
      if (extBytes.length === 8) {
        const high = (extBytes[0] << 24) | (extBytes[1] << 16) | (extBytes[2] << 8) | extBytes[3];
        const low = (extBytes[4] << 24) | (extBytes[5] << 16) | (extBytes[6] << 8) | extBytes[7];
        actualSize = high * 4294967296 + low;
        headerSize = 16;
      }
    }
    
    return { size: actualSize, type, headerSize };
  } catch {
    return null;
  }
}

async function readDataBoxValue(fileUri: string, position: number, size: number, headerSize: number): Promise<{ type: 'text' | 'cover'; value: any } | null> {
  try {
    const payloadOffset = position + headerSize;
    const valueOffset = payloadOffset + 8;
    const valueLength = size - headerSize - 8;
    
    if (valueLength <= 0) return null;
    
    const headerBase64 = await FileSystem.readAsStringAsync(fileUri, {
      encoding: FileSystem.EncodingType.Base64,
      position: payloadOffset,
      length: 4,
    });
    const headerBytes = base64ToBytes(headerBase64);
    if (headerBytes.length < 4) return null;
    
    const typeFlag = headerBytes[3]; // last byte of flags
    
    if (typeFlag === 1) {
      // Text
      const textBase64 = await FileSystem.readAsStringAsync(fileUri, {
        encoding: FileSystem.EncodingType.Base64,
        position: valueOffset,
        length: valueLength,
      });
      const textBytes = base64ToBytes(textBase64);
      const reader = new BinaryReader(textBytes);
      return { type: 'text', value: reader.readUtf8String(textBytes.length) };
    } else if (typeFlag === 13 || typeFlag === 14) {
      // Cover (13 = JPEG, 14 = PNG)
      const coverBase64 = await FileSystem.readAsStringAsync(fileUri, {
        encoding: FileSystem.EncodingType.Base64,
        position: valueOffset,
        length: valueLength,
      });
      return {
        type: 'cover',
        value: {
          mimeType: typeFlag === 13 ? 'image/jpeg' : 'image/png',
          base64: coverBase64,
        },
      };
    }
    
    return null;
  } catch {
    return null;
  }
}

async function parseMvhdBox(fileUri: string, position: number, size: number, headerSize: number): Promise<number> {
  try {
    const mvhdBase64 = await FileSystem.readAsStringAsync(fileUri, {
      encoding: FileSystem.EncodingType.Base64,
      position: position + headerSize,
      length: Math.min(size - headerSize, 36),
    });
    const bytes = base64ToBytes(mvhdBase64);
    const reader = new BinaryReader(bytes);
    
    const version = reader.readUint8();
    reader.skip(3); // flags
    
    let timescale = 0;
    let duration = 0;
    
    if (version === 1) {
      reader.skip(16); // creation and modification times
      timescale = reader.readUint32();
      duration = reader.readUint64();
    } else {
      reader.skip(8); // creation and modification times
      timescale = reader.readUint32();
      duration = reader.readUint32();
    }
    
    if (timescale > 0) {
      return duration / timescale;
    }
    return 0;
  } catch {
    return 0;
  }
}

async function parseChplBox(fileUri: string, position: number, size: number, headerSize: number): Promise<Omit<ParsedChapter, 'endTime'>[]> {
  try {
    const chplBase64 = await FileSystem.readAsStringAsync(fileUri, {
      encoding: FileSystem.EncodingType.Base64,
      position: position + headerSize,
      length: size - headerSize,
    });
    const bytes = base64ToBytes(chplBase64);
    const reader = new BinaryReader(bytes);
    
    const version = reader.readUint8();
    reader.skip(3); // flags
    
    let chapterCount = 0;
    if (version === 1) {
      reader.skip(1); // reserved
      chapterCount = reader.readUint32();
    } else {
      chapterCount = reader.readUint8();
    }
    
    const chapters: Omit<ParsedChapter, 'endTime'>[] = [];
    for (let i = 0; i < chapterCount; i++) {
      if (!reader.hasRemaining(9)) break;
      const startTimeUnits = reader.readUint64();
      const startTime = startTimeUnits / 10000000; // convert 100-nanosecond units to seconds
      const titleLen = reader.readUint8();
      
      if (!reader.hasRemaining(titleLen)) break;
      const title = reader.readUtf8String(titleLen);
      
      chapters.push({ title, startTime });
    }
    
    return chapters;
  } catch {
    return [];
  }
}

// --- Main Parser Function ---

export async function parseM4bMetadata(fileUri: string): Promise<ParsedM4bData> {
  const result: ParsedM4bData = {
    title: '',
    author: null,
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
    let pos = 0;
    
    // Step 1: Scan top-level atoms to locate 'moov' (ignoring large media atoms like 'mdat')
    let moovHeader: { position: number; size: number; headerSize: number } | null = null;
    while (pos < fileSize) {
      const header = await readAtomHeader(fileUri, pos);
      if (!header || header.size === 0) break;
      
      if (header.type === 'moov') {
        moovHeader = { position: pos, size: header.size, headerSize: header.headerSize };
        break; // We found the movie atom, no need to read further
      }
      
      pos += header.size;
    }
    
    if (!moovHeader) {
      throw new Error('Invalid file format: moov box not found.');
    }
    
    // Step 2: Parse 'moov' children to find metadata components
    const moovEnd = moovHeader.position + moovHeader.size;
    let mvhdHeader: { position: number; size: number; headerSize: number } | null = null;
    let udtaHeader: { position: number; size: number; headerSize: number } | null = null;
    
    pos = moovHeader.position + moovHeader.headerSize;
    while (pos < moovEnd) {
      const header = await readAtomHeader(fileUri, pos);
      if (!header || header.size === 0) break;
      
      if (header.type === 'mvhd') {
        mvhdHeader = { position: pos, size: header.size, headerSize: header.headerSize };
      } else if (header.type === 'udta') {
        udtaHeader = { position: pos, size: header.size, headerSize: header.headerSize };
      }
      
      pos += header.size;
    }
    
    // Parse Duration
    if (mvhdHeader) {
      result.duration = await parseMvhdBox(fileUri, mvhdHeader.position, mvhdHeader.size, mvhdHeader.headerSize);
    }
    
    // Parse metadata inside 'udta'
    if (udtaHeader) {
      const udtaEnd = udtaHeader.position + udtaHeader.size;
      let metaHeader: { position: number; size: number; headerSize: number } | null = null;
      let chplHeader: { position: number; size: number; headerSize: number } | null = null;
      
      pos = udtaHeader.position + udtaHeader.headerSize;
      while (pos < udtaEnd) {
        const header = await readAtomHeader(fileUri, pos);
        if (!header || header.size === 0) break;
        
        if (header.type === 'meta') {
          metaHeader = { position: pos, size: header.size, headerSize: header.headerSize };
        } else if (header.type === 'chpl') {
          chplHeader = { position: pos, size: header.size, headerSize: header.headerSize };
        }
        
        pos += header.size;
      }
      
      // Parse Nero Chapters if found
      let tempChapters: Omit<ParsedChapter, 'endTime'>[] = [];
      if (chplHeader) {
        tempChapters = await parseChplBox(fileUri, chplHeader.position, chplHeader.size, chplHeader.headerSize);
      }
      
      // Parse iTunes metadata (ilst) inside 'meta'
      if (metaHeader) {
        const metaEnd = metaHeader.position + metaHeader.size;
        let ilstHeader: { position: number; size: number; headerSize: number } | null = null;
        
        // meta box starts with 4 bytes of version/flags
        pos = metaHeader.position + metaHeader.headerSize + 4;
        while (pos < metaEnd) {
          const header = await readAtomHeader(fileUri, pos);
          if (!header || header.size === 0) break;
          
          if (header.type === 'ilst') {
            ilstHeader = { position: pos, size: header.size, headerSize: header.headerSize };
            break;
          }
          
          pos += header.size;
        }
        
        if (ilstHeader) {
          const ilstEnd = ilstHeader.position + ilstHeader.size;
          pos = ilstHeader.position + ilstHeader.headerSize;
          
          while (pos < ilstEnd) {
            const keyHeader = await readAtomHeader(fileUri, pos);
            if (!keyHeader || keyHeader.size === 0) break;
            
            const keyEnd = pos + keyHeader.size;
            let subPos = pos + keyHeader.headerSize;
            
            // Look for a 'data' box inside this metadata tag
            while (subPos < keyEnd) {
              const subHeader = await readAtomHeader(fileUri, subPos);
              if (!subHeader || subHeader.size === 0) break;
              
              if (subHeader.type === 'data') {
                const dataVal = await readDataBoxValue(fileUri, subPos, subHeader.size, subHeader.headerSize);
                if (dataVal) {
                  const key = keyHeader.type;
                  if (dataVal.type === 'text') {
                    const text = dataVal.value;
                    if (key === '©nam' || key === '©NAM' || key === 'nam') result.title = text;
                    else if (key === '©ART' || key === '©art' || key === 'ART' || key === 'art') result.author = text;
                    else if (key === '©alb' || key === '©ALB' || key === 'alb') result.album = text;
                    else if (key === '©des' || key === 'desc') result.description = text;
                    else if (key === '©gen' || key === 'genre') result.genre = text;
                    else if (key === '©day' || key === 'year') {
                      const yearMatch = text.match(/\d{4}/);
                      if (yearMatch) result.year = parseInt(yearMatch[0], 10);
                    }
                  } else if (dataVal.type === 'cover') {
                    result.coverBase64 = dataVal.value.base64;
                    result.coverType = dataVal.value.mimeType;
                  }
                }
                break;
              }
              subPos += subHeader.size;
            }
            pos += keyHeader.size;
          }
        }
      }
      
      // Complete Chapters processing
      if (tempChapters.length > 0) {
        const chapters: ParsedChapter[] = [];
        for (let i = 0; i < tempChapters.length; i++) {
          const endTime = (i < tempChapters.length - 1) 
            ? tempChapters[i + 1].startTime 
            : result.duration;
          
          chapters.push({
            title: tempChapters[i].title,
            startTime: tempChapters[i].startTime,
            endTime: endTime,
          });
        }
        result.chapters = chapters;
      }
    }
  } catch (error) {
    console.error('Error parsing M4B file:', error);
  }

  // Fallback title if empty
  if (!result.title) {
    const filename = fileUri.substring(fileUri.lastIndexOf('/') + 1);
    result.title = filename.substring(0, filename.lastIndexOf('.')) || filename;
  }
  
  // If no chapters found or only 1 chapter covering > 10 mins (600s), auto-segment into logical ~15 min chapters
  if (result.chapters.length === 0 || (result.chapters.length === 1 && result.duration > 600)) {
    result.chapters = autoSegmentChapters(result.duration);
  }

  return result;
}

export function autoSegmentChapters(duration: number): ParsedChapter[] {
  if (duration <= 0) {
    return [{ title: 'Chapter 1', startTime: 0, endTime: 0 }];
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

