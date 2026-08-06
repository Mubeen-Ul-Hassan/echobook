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

    const audiobooksDir = `${FileSystem.documentDirectory}audiobooks/`;
    const coversDir = `${FileSystem.documentDirectory}covers/`;

    await FileSystem.makeDirectoryAsync(audiobooksDir, { intermediates: true });
    await FileSystem.makeDirectoryAsync(coversDir, { intermediates: true });

    for (const asset of pickerResult.assets) {
      try {
        const bookId = 'book_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 7);
        const fileExt = asset.name.substring(asset.name.lastIndexOf('.')) || '.m4b';

        // 1. Copy audiobook file to persistent audiobooks directory first
        const audioDestPath = `${audiobooksDir}${bookId}${fileExt}`;
        await FileSystem.copyAsync({
          from: asset.uri,
          to: audioDestPath,
        });

        // 2. Extract metadata & chapters from local fileUri (file://...) where random seeking is supported!
        const parsedData = await parseM4bMetadata(audioDestPath, asset.name);

        // 3. Save cover image to persistent storage if extracted
        let coverPath: string | null = null;
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
      } catch (error) {
        console.error(`Failed to import asset "${asset.name}":`, error);
      }
    }

    return importedBooks;
  },

  /**
   * Re-parses an existing audiobook's audio file to extract cover artwork or chapters if missing.
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

      const isAutoSegmentedOnly =
        existingChapters.length <= 1 ||
        isAutoSegmented15Min ||
        existingChapters.every((c) => /^Chapter \d+$/i.test(c.title));

      if (!needsCover && !isAutoSegmentedOnly) {
        return { audiobook: book, chapters: existingChapters };
      }

      const parsedData = await parseM4bMetadata(book.audioPath);
      let updatedCoverPath = book.coverPath;

      // Extract & Save Cover Image
      if (needsCover && parsedData.coverBase64) {
        const coversDir = `${FileSystem.documentDirectory}covers/`;
        await FileSystem.makeDirectoryAsync(coversDir, { intermediates: true });
        const coverExt = parsedData.coverType === 'image/png' ? '.png' : '.jpg';
        updatedCoverPath = `${coversDir}${bookId}${coverExt}`;

        await FileSystem.writeAsStringAsync(updatedCoverPath, parsedData.coverBase64, {
          encoding: FileSystem.EncodingType.Base64,
        });
        await dbService.updateAudiobookCoverPath(db, bookId, updatedCoverPath);
      }

      // Replace Chapters if real embedded chapters were found
      let finalChapters = existingChapters;
      if (parsedData.chapters.length > 0) {
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
