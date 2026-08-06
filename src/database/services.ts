import { type SQLiteDatabase } from 'expo-sqlite';
import { AudiobookRecord, ChapterRecord, PlaybackRecord, BookmarkRecord } from './types';

export const dbService = {
  // --- Audiobook Operations ---
  
  async insertAudiobook(db: SQLiteDatabase, book: AudiobookRecord): Promise<void> {
    await db.runAsync(
      `INSERT INTO audiobooks (
        id, title, author, narrator, album, series, publisher, description, 
        language, genre, year, coverPath, audioPath, duration, 
        codec, bitrate, sampleRate, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      [
        book.id,
        book.title,
        book.author,
        book.narrator ?? null,
        book.album,
        book.series,
        book.publisher,
        book.description,
        book.language,
        book.genre,
        book.year,
        book.coverPath,
        book.audioPath,
        book.duration,
        book.codec,
        book.bitrate,
        book.sampleRate,
        book.createdAt,
        book.updatedAt,
      ]
    );
  },

  async getAudiobooks(db: SQLiteDatabase): Promise<AudiobookRecord[]> {
    return await db.getAllAsync<AudiobookRecord>('SELECT * FROM audiobooks ORDER BY createdAt DESC;');
  },

  async getAudiobookById(db: SQLiteDatabase, id: string): Promise<AudiobookRecord | null> {
    return await db.getFirstAsync<AudiobookRecord>('SELECT * FROM audiobooks WHERE id = ?;', [id]);
  },

  async updateAudiobookCoverPath(db: SQLiteDatabase, bookId: string, coverPath: string): Promise<void> {
    await db.runAsync('UPDATE audiobooks SET coverPath = ?, updatedAt = ? WHERE id = ?;', [
      coverPath,
      new Date().toISOString(),
      bookId,
    ]);
  },

  async updateAudiobookDuration(db: SQLiteDatabase, bookId: string, duration: number): Promise<void> {
    await db.runAsync('UPDATE audiobooks SET duration = ?, updatedAt = ? WHERE id = ?;', [
      duration,
      new Date().toISOString(),
      bookId,
    ]);
  },

  async deleteAudiobook(db: SQLiteDatabase, id: string): Promise<void> {
    await db.runAsync('DELETE FROM audiobooks WHERE id = ?;', [id]);
  },

  // --- Chapter Operations ---

  async insertChapters(db: SQLiteDatabase, chapters: ChapterRecord[]): Promise<void> {
    if (chapters.length === 0) return;
    
    await db.withTransactionAsync(async () => {
      for (const chapter of chapters) {
        await db.runAsync(
          `INSERT INTO chapters (id, bookId, title, startTime, endTime, duration, \`order\`)
           VALUES (?, ?, ?, ?, ?, ?, ?);`,
          [
            chapter.id,
            chapter.bookId,
            chapter.title,
            chapter.startTime,
            chapter.endTime,
            chapter.duration,
            chapter.order,
          ]
        );
      }
    });
  },

  async replaceBookChapters(db: SQLiteDatabase, bookId: string, chapters: ChapterRecord[]): Promise<void> {
    await db.withTransactionAsync(async () => {
      await db.runAsync('DELETE FROM chapters WHERE bookId = ?;', [bookId]);
      for (const chapter of chapters) {
        await db.runAsync(
          `INSERT INTO chapters (id, bookId, title, startTime, endTime, duration, \`order\`)
           VALUES (?, ?, ?, ?, ?, ?, ?);`,
          [
            chapter.id,
            chapter.bookId,
            chapter.title,
            chapter.startTime,
            chapter.endTime,
            chapter.duration,
            chapter.order,
          ]
        );
      }
    });
  },

  async getChaptersByBookId(db: SQLiteDatabase, bookId: string): Promise<ChapterRecord[]> {
    const existing = await db.getAllAsync<ChapterRecord>(
      'SELECT * FROM chapters WHERE bookId = ? ORDER BY `order` ASC;',
      [bookId]
    );

    if (existing.length > 0) {
      return existing;
    }

    // If no chapters exist, check if book exists and auto-segment
    const book = await db.getFirstAsync<AudiobookRecord>('SELECT * FROM audiobooks WHERE id = ?;', [bookId]);
    if (book && book.duration > 0) {
      const SEGMENT_DURATION = 900;
      const newChapters: ChapterRecord[] = [];
      let currentTime = 0;
      let idx = 0;

      while (currentTime < book.duration) {
        const nextTime = Math.min(book.duration, currentTime + SEGMENT_DURATION);
        const remaining = book.duration - nextTime;
        const finalEndTime = remaining < 120 ? book.duration : nextTime;

        newChapters.push({
          id: `${bookId}_ch_${idx}`,
          bookId,
          title: `Chapter ${idx + 1}`,
          startTime: currentTime,
          endTime: finalEndTime,
          duration: finalEndTime - currentTime,
          order: idx,
        });

        currentTime = finalEndTime;
        idx++;
      }

      await this.insertChapters(db, newChapters);
      return newChapters;
    }

    return [];
  },

  // --- Playback Operations ---

  async getAllPlaybacks(db: SQLiteDatabase): Promise<PlaybackRecord[]> {
    return await db.getAllAsync<PlaybackRecord>('SELECT * FROM playbacks;');
  },

  async getPlayback(db: SQLiteDatabase, bookId: string): Promise<PlaybackRecord | null> {
    return await db.getFirstAsync<PlaybackRecord>('SELECT * FROM playbacks WHERE bookId = ?;', [bookId]);
  },

  async savePlayback(db: SQLiteDatabase, playback: PlaybackRecord): Promise<void> {
    await db.runAsync(
      `INSERT INTO playbacks (bookId, chapterId, position, speed, lastPlayed, completed)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(bookId) DO UPDATE SET
         chapterId = excluded.chapterId,
         position = excluded.position,
         speed = excluded.speed,
         lastPlayed = excluded.lastPlayed,
         completed = excluded.completed;`,
      [
        playback.bookId,
        playback.chapterId,
        playback.position,
        playback.speed,
        playback.lastPlayed,
        playback.completed,
      ]
    );
  },

  async getRecentPlaybacks(db: SQLiteDatabase, limit: number = 5): Promise<(PlaybackRecord & { title: string; author: string | null; coverPath: string | null })[]> {
    return await db.getAllAsync<PlaybackRecord & { title: string; author: string | null; coverPath: string | null }>(
      `SELECT p.*, a.title, a.author, a.coverPath
       FROM playbacks p
       JOIN audiobooks a ON p.bookId = a.id
       ORDER BY p.lastPlayed DESC
       LIMIT ?;`,
      [limit]
    );
  },

  // --- Bookmark Operations ---

  async insertBookmark(db: SQLiteDatabase, bookmark: BookmarkRecord): Promise<void> {
    await db.runAsync(
      `INSERT INTO bookmarks (id, bookId, chapterId, position, note, createdAt)
       VALUES (?, ?, ?, ?, ?, ?);`,
      [
        bookmark.id,
        bookmark.bookId,
        bookmark.chapterId,
        bookmark.position,
        bookmark.note,
        bookmark.createdAt,
      ]
    );
  },

  async getBookmarksByBookId(db: SQLiteDatabase, bookId: string): Promise<BookmarkRecord[]> {
    return await db.getAllAsync<BookmarkRecord>(
      'SELECT * FROM bookmarks WHERE bookId = ? ORDER BY position ASC;',
      [bookId]
    );
  },

  async deleteBookmark(db: SQLiteDatabase, id: string): Promise<void> {
    await db.runAsync('DELETE FROM bookmarks WHERE id = ?;', [id]);
  },
};
