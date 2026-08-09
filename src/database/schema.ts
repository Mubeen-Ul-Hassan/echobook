import { type SQLiteDatabase } from 'expo-sqlite';

export const DATABASE_VERSION = 1;

export async function migrateDbIfNeeded(db: SQLiteDatabase) {
  // Enable foreign key constraints and Write-Ahead Logging (WAL)
  await db.execAsync(`PRAGMA foreign_keys = ON;`);
  await db.execAsync(`PRAGMA journal_mode = WAL;`);

  const result = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version;');
  let currentVersion = result?.user_version ?? 0;

  if (currentVersion >= DATABASE_VERSION) {
    return;
  }

  if (currentVersion === 0) {
    await db.withTransactionAsync(async () => {
      // Version 1: Create base schema tables
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS audiobooks (
          id TEXT PRIMARY KEY NOT NULL,
          title TEXT NOT NULL,
          author TEXT,
          narrator TEXT,
          album TEXT,
          series TEXT,
          publisher TEXT,
          description TEXT,
          language TEXT,
          genre TEXT,
          year INTEGER,
          coverPath TEXT,
          audioPath TEXT NOT NULL,
          duration REAL NOT NULL,
          codec TEXT,
          bitrate INTEGER,
          sampleRate INTEGER,
          createdAt TEXT NOT NULL,
          updatedAt TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS chapters (
          id TEXT PRIMARY KEY NOT NULL,
          bookId TEXT NOT NULL,
          title TEXT NOT NULL,
          startTime REAL NOT NULL,
          endTime REAL NOT NULL,
          duration REAL NOT NULL,
          \`order\` INTEGER NOT NULL,
          FOREIGN KEY (bookId) REFERENCES audiobooks(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS playbacks (
          bookId TEXT PRIMARY KEY NOT NULL,
          chapterId TEXT,
          position REAL NOT NULL DEFAULT 0.0,
          speed REAL NOT NULL DEFAULT 1.0,
          lastPlayed TEXT NOT NULL,
          completed INTEGER NOT NULL DEFAULT 0,
          FOREIGN KEY (bookId) REFERENCES audiobooks(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS bookmarks (
          id TEXT PRIMARY KEY NOT NULL,
          bookId TEXT NOT NULL,
          chapterId TEXT,
          position REAL NOT NULL,
          note TEXT,
          createdAt TEXT NOT NULL,
          FOREIGN KEY (bookId) REFERENCES audiobooks(id) ON DELETE CASCADE
        );
      `);
      await db.execAsync(`PRAGMA user_version = 1;`);
    });
    currentVersion = 1;
  }
}
