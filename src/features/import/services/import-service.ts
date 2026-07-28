import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { type SQLiteDatabase } from 'expo-sqlite';
import { dbService } from '@/database/services';
import { parseM4bMetadata } from './m4b-parser';
import { AudiobookRecord, ChapterRecord, PlaybackRecord } from '@/database/types';

export const importService = {
  /**
   * Opens the system file picker to select audiobook files, parses their metadata/chapters,
   * copies them into persistent application storage, and records them in the database.
   */
  async pickAndImportAudiobooks(db: SQLiteDatabase): Promise<AudiobookRecord[]> {
    const pickerResult = await DocumentPicker.getDocumentAsync({
      type: [
        'audio/mp4',
        'audio/x-m4b',
        'audio/m4b',
        'audio/x-m4a',
        'audio/m4a',
        'audio/aac',
      ],
      copyToCacheDirectory: true,
      multiple: true,
    });

    if (pickerResult.canceled) {
      return [];
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
