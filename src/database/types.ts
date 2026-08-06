export interface AudiobookRecord {
  id: string;
  title: string;
  author: string | null;
  narrator: string | null;
  album: string | null;
  series: string | null;
  publisher: string | null;
  description: string | null;
  language: string | null;
  genre: string | null;
  year: number | null;
  coverPath: string | null;
  audioPath: string;
  duration: number; // in seconds
  codec: string | null;
  bitrate: number | null;
  sampleRate: number | null;
  createdAt: string; // ISO string
  updatedAt: string; // ISO string
}

export interface ChapterRecord {
  id: string;
  bookId: string;
  title: string;
  startTime: number; // in seconds
  endTime: number; // in seconds
  duration: number; // in seconds
  order: number;
}

export interface PlaybackRecord {
  bookId: string;
  chapterId: string | null;
  position: number; // in seconds
  speed: number;
  lastPlayed: string; // ISO string
  completed: number; // 0 or 1
}

export interface BookmarkRecord {
  id: string;
  bookId: string;
  chapterId: string | null;
  position: number; // in seconds
  note: string | null;
  createdAt: string; // ISO string
}
