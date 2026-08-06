import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import { type SQLiteDatabase } from 'expo-sqlite';
import { dbService } from '@/database/services';
import { parseM4bMetadata } from './m4b-parser';
import { AudiobookRecord, ChapterRecord, PlaybackRecord } from '@/database/types';

export const importService = {
  /**
   * Opens the system file picker to select audiobook files, parses their metadata/chapters,
   * copies them into persistent application storage, and records them in the database.
   */
  async pickAndImportAudiobooks(db: SQLiteDatabase): Promise<AudiobookRecord[] | null> {
    if (Platform.OS === 'web') {
      throw new Error(
        'Import works on Android or iOS only. Start the app with Expo Go on your phone ' +
          '(npx expo start, then scan the QR code) — not in the browser.'
      );
    }

    if (!FileSystem.documentDirectory) {
      throw new Error('App storage is unavailable. Restart the app and try again.');
    }

    const pickerResult = await DocumentPicker.getDocumentAsync({
      type: [
        'audio/*',
        'audio/mp4',
        'audio/x-m4b',
        'audio/m4b',
        'audio/x-m4a',
        'audio/m4a',
        'audio/mp3',
        'audio/mpeg',
        'audio/aac',
        'video/mp4',
        'application/octet-stream',
      ],
      copyToCacheDirectory: false,
      multiple: true,
    });

    if (pickerResult.canceled) {
      return null;
    }

    const importedBooks: AudiobookRecord[] = [];
    const importErrors: string[] = [];

    const audiobooksDir = `${FileSystem.documentDirectory}audiobooks/`;
    const coversDir = `${FileSystem.documentDirectory}covers/`;

    await FileSystem.makeDirectoryAsync(audiobooksDir, { intermediates: true });
    await FileSystem.makeDirectoryAsync(coversDir, { intermediates: true });

    for (const asset of pickerResult.assets) {
      let audioDestPath: string | null = null;
      let coverPath: string | null = null;

      try {
        const bookId = 'book_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 7);
        const fileExt = asset.name.substring(asset.name.lastIndexOf('.')) || '.m4b';

        // Determine asset file size (from asset.size or getInfoAsync)
        let assetSize = typeof asset.size === 'number' && asset.size > 0 ? asset.size : 0;
        if (!assetSize && asset.uri) {
          try {
            const info = await FileSystem.getInfoAsync(asset.uri);
            if (info.exists && typeof info.size === 'number' && info.size > 0) {
              assetSize = info.size;
            }
          } catch (_) {
            // Ignore if getInfoAsync fails on content URI
          }
        }

        // Pre-check free disk space before starting expensive copyAsync
        try {
          const freeStorageBytes = await FileSystem.getFreeDiskStorageAsync();
          if (assetSize > 0) {
            const requiredBytes = assetSize + 10 * 1024 * 1024; // 10MB safety margin
            if (freeStorageBytes < requiredBytes) {
              const freeMB = (freeStorageBytes / (1024 * 1024)).toFixed(1);
              const neededMB = (assetSize / (1024 * 1024)).toFixed(1);
              throw new Error(
                `Not enough storage space on device. Available: ${freeMB} MB, Required: ${neededMB} MB.`
              );
            }
          } else if (freeStorageBytes < 50 * 1024 * 1024) {
            // Safety fallback if size is completely unknown and free space is under 50MB
            const freeMB = (freeStorageBytes / (1024 * 1024)).toFixed(1);
            throw new Error(
              `Device storage is almost full (only ${freeMB} MB free). Free up space to import audiobooks.`
            );
          }
        } catch (storageErr: any) {
          if (
            storageErr?.message?.includes('Not enough storage space') ||
            storageErr?.message?.includes('Device storage is almost full')
          ) {
            throw storageErr;
          }
          // Ignore if getFreeDiskStorageAsync is unsupported on platform
        }

        // 1. Copy audiobook file to persistent audiobooks directory first
        audioDestPath = `${audiobooksDir}${bookId}${fileExt}`;
        await FileSystem.copyAsync({
          from: asset.uri,
          to: audioDestPath,
        });

        // 2. Extract metadata & chapters from local fileUri (file://...) where random seeking is supported!
        const parsedData = await parseM4bMetadata(audioDestPath, asset.name);

        // 3. Save cover image to persistent storage if extracted
        if (parsedData.coverBase64) {
          const coverExt = parsedData.coverType === 'image/png' ? '.png' : '.jpg';
          coverPath = `${coversDir}${bookId}${coverExt}`;
          await FileSystem.writeAsStringAsync(coverPath, parsedData.coverBase64, {
            encoding: FileSystem.EncodingType.Base64,
          });
        }

        const nowIso = new Date().toISOString();
        const audiobook: AudiobookRecord = {
          id: bookId,
          title: parsedData.title,
          author: parsedData.author,
          narrator: parsedData.narrator,
          album: parsedData.album,
          series: null,
          publisher: null,
          description: parsedData.description,
          language: null,
          genre: parsedData.genre,
          year: parsedData.year,
          coverPath: coverPath,
          audioPath: audioDestPath,
          duration: parsedData.duration,
          codec: fileExt.replace('.', '').toUpperCase(),
          bitrate: null,
          sampleRate: null,
          createdAt: nowIso,
          updatedAt: nowIso,
        };

        await dbService.insertAudiobook(db, audiobook);

        const chapters: ChapterRecord[] = parsedData.chapters.map((ch, idx) => ({
          id: `${bookId}_ch_${idx}`,
          bookId: bookId,
          title: ch.title,
          startTime: ch.startTime,
          endTime: ch.endTime,
          duration: ch.endTime - ch.startTime,
          order: idx,
        }));
        await dbService.insertChapters(db, chapters);

        const playback: PlaybackRecord = {
          bookId: bookId,
          chapterId: chapters[0]?.id || null,
          position: 0,
          speed: 1.0,
          lastPlayed: nowIso,
          completed: 0,
        };
        await dbService.savePlayback(db, playback);

        importedBooks.push(audiobook);
      } catch (error: any) {
        // Clean up partial files if copy or processing failed mid-way
        if (audioDestPath) {
          await FileSystem.deleteAsync(audioDestPath, { idempotent: true }).catch(() => {});
        }
        if (coverPath) {
          await FileSystem.deleteAsync(coverPath, { idempotent: true }).catch(() => {});
        }

        const rawMsg = error?.message || String(error);
        let errorMsg = rawMsg;
        if (rawMsg.includes('ENOSPC') || rawMsg.includes('No space left on device')) {
          errorMsg = `Storage full: Not enough disk space on your device to copy "${asset.name}".`;
        } else if (!rawMsg.startsWith('Not enough storage space') && !rawMsg.startsWith('Device storage is almost full')) {
          errorMsg = `Failed to import "${asset.name}": ${rawMsg}`;
        }

        console.warn(errorMsg);
        importErrors.push(errorMsg);
      }
    }

    if (importedBooks.length === 0 && importErrors.length > 0) {
      throw new Error(importErrors.join('\n\n'));
    }

    return importedBooks;
  },

  /**
   * Re-parses an existing audiobook's audio file to backfill any missing or broken
   * metadata: chapters (if previously auto-segmented), cover artwork, author,
   * narrator, album, description, genre, and year.
   *
   * The expensive full-file re-parse runs at most once per book per app session
   * (see `repairedThisSession`) so opening a book repeatedly never causes
   * repeated heavy JS work while audio is playing.
   */
  async repairOrRefreshBookMetadata(
    db: SQLiteDatabase,
    bookId: string
  ): Promise<{ audiobook: AudiobookRecord | null; chapters: ChapterRecord[] }> {
    try {
      const book = await dbService.getAudiobookById(db, bookId);
      if (!book || !book.audioPath) {
        return { audiobook: null, chapters: [] };
      }

      const existingChapters = await dbService.getChaptersByBookId(db, bookId);

      if (repairedThisSession.has(bookId)) {
        return { audiobook: book, chapters: existingChapters };
      }

      // Check if cover file exists on disk
      let needsCover = !book.coverPath;
      if (book.coverPath) {
        const coverInfo = await FileSystem.getInfoAsync(book.coverPath);
        if (!coverInfo.exists) {
          needsCover = true;
        }
      }

      // Check if real chapters exist or if book was previously auto-segmented into 15-min clips
      const isAutoSegmented15Min =
        existingChapters.length > 1 &&
        existingChapters.every((c, idx) => Math.abs(c.startTime - idx * 900) < 2);

      const needsChapters =
        existingChapters.length <= 1 ||
        isAutoSegmented15Min ||
        existingChapters.every((c) => /^Chapter \d+$/i.test(c.title));

      const needsTextMetadata = !book.author || !book.narrator || !book.description;

      if (!needsCover && !needsChapters && !needsTextMetadata) {
        repairedThisSession.add(bookId);
        return { audiobook: book, chapters: existingChapters };
      }

      const parsedData = await parseM4bMetadata(book.audioPath);
      repairedThisSession.add(bookId);

      // Extract & Save Cover Image
      let updatedCoverPath: string | undefined;
      if (needsCover && parsedData.coverBase64) {
        const coversDir = `${FileSystem.documentDirectory}covers/`;
        await FileSystem.makeDirectoryAsync(coversDir, { intermediates: true });
        const coverExt = parsedData.coverType === 'image/png' ? '.png' : '.jpg';
        updatedCoverPath = `${coversDir}${bookId}${coverExt}`;

        await FileSystem.writeAsStringAsync(updatedCoverPath, parsedData.coverBase64, {
          encoding: FileSystem.EncodingType.Base64,
        });
      }

      // Backfill any missing text metadata (never overwrite existing values,
      // except a title that is clearly a filename fallback).
      const hasRealParsedTitle =
        !!parsedData.title &&
        !parsedData.title.startsWith('content:') &&
        !parsedData.title.startsWith('file:');

      await dbService.updateAudiobookMetadata(db, bookId, {
        title: !book.title && hasRealParsedTitle ? parsedData.title : undefined,
        author: !book.author && parsedData.author ? parsedData.author : undefined,
        narrator: !book.narrator && parsedData.narrator ? parsedData.narrator : undefined,
        album: !book.album && parsedData.album ? parsedData.album : undefined,
        description: !book.description && parsedData.description ? parsedData.description : undefined,
        genre: !book.genre && parsedData.genre ? parsedData.genre : undefined,
        year: !book.year && parsedData.year ? parsedData.year : undefined,
        duration: book.duration <= 0 && parsedData.duration > 0 ? parsedData.duration : undefined,
        coverPath: updatedCoverPath,
      });

      // Replace chapters only when the existing ones are broken/auto-segmented
      // AND the fresh parse found something (real chapters have non-generic titles).
      let finalChapters = existingChapters;
      const parsedHasRealChapters = parsedData.chapters.some(
        (ch) => !/^Chapter \d+$/i.test(ch.title)
      );
      if (needsChapters && parsedData.chapters.length > 0 && (parsedHasRealChapters || existingChapters.length === 0)) {
        const newChapters: ChapterRecord[] = parsedData.chapters.map((ch, idx) => ({
          id: `${bookId}_ch_${idx}`,
          bookId,
          title: ch.title,
          startTime: ch.startTime,
          endTime: ch.endTime,
          duration: ch.endTime - ch.startTime,
          order: idx,
        }));
        await dbService.replaceBookChapters(db, bookId, newChapters);
        finalChapters = newChapters;
      }

      const updatedBook = await dbService.getAudiobookById(db, bookId);
      return { audiobook: updatedBook, chapters: finalChapters };
    } catch (error) {
      console.error('Failed to repair audiobook metadata:', error);
      const book = await dbService.getAudiobookById(db, bookId);
      const chapters = await dbService.getChaptersByBookId(db, bookId);
      return { audiobook: book, chapters };
    }
  },
};

/** Books whose metadata has already been checked/repaired in this app session. */
const repairedThisSession = new Set<string>();
