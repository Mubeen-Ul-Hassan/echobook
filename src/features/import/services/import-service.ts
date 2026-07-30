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
   *
   * Note: Import is intended for Android / iOS. Web browsers cannot reliably read large
   * local M4B files via expo-file-system (FileReader fails on media blobs).
   */
  async pickAndImportAudiobooks(db: SQLiteDatabase): Promise<AudiobookRecord[] | null> {
    if (Platform.OS === 'web') {
      throw new Error(
        'Import works on Android or iOS only. Start the app with Expo Go on your phone ' +
          '(npx expo start, then scan the QR code) — not in the browser.',
      );
    }

    if (!FileSystem.documentDirectory) {
      throw new Error('App storage is unavailable. Restart the app and try again.');
    }

    const pickerResult = await DocumentPicker.getDocumentAsync({
      // Broaden types so Android file managers surface .m4b files reliably
      type: [
        'audio/*',
        'audio/mp4',
        'audio/x-m4b',
        'audio/m4b',
        'audio/x-m4a',
        'audio/m4a',
        'audio/aac',
        'video/mp4',
        'application/octet-stream',
      ],
      copyToCacheDirectory: true,
      multiple: true,
    });

    if (pickerResult.canceled) {
      return null;
    }

    const importedBooks: AudiobookRecord[] = [];

    // Define storage directories inside the application's documents directory
    const audiobooksDir = `${FileSystem.documentDirectory}audiobooks/`;
    const coversDir = `${FileSystem.documentDirectory}covers/`;

    // Ensure the persistent directories exist
    await FileSystem.makeDirectoryAsync(audiobooksDir, { intermediates: true });
    await FileSystem.makeDirectoryAsync(coversDir, { intermediates: true });

    for (const asset of pickerResult.assets) {
      try {
        const bookId = 'book_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 7);
        const fileExt = asset.name.substring(asset.name.lastIndexOf('.')) || '.m4b';
        
        // Extract metadata & chapters from the picked file URI
        const parsedData = await parseM4bMetadata(asset.uri);
        
        // Save the cover image to a persistent file if present
        let coverPath: string | null = null;
        if (parsedData.coverBase64 && parsedData.coverType) {
          const coverExt = parsedData.coverType === 'image/png' ? '.png' : '.jpg';
          coverPath = `${coversDir}${bookId}${coverExt}`;
          await FileSystem.writeAsStringAsync(coverPath, parsedData.coverBase64, {
            encoding: FileSystem.EncodingType.Base64,
          });
        }

        // Copy the audiobook file from the temporary cache directory to the persistent audiobooks directory
        const audioDestPath = `${audiobooksDir}${bookId}${fileExt}`;
        await FileSystem.copyAsync({
          from: asset.uri,
          to: audioDestPath,
        });

        const nowIso = new Date().toISOString();
        const audiobook: AudiobookRecord = {
          id: bookId,
          title: parsedData.title,
          author: parsedData.author,
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

        // Insert audiobook record into SQLite
        await dbService.insertAudiobook(db, audiobook);

        // Map and insert chapter records
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

        // Set up default playback status
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
  }
};
