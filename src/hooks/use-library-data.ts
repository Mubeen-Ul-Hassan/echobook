import { useState, useCallback, useMemo } from 'react';
import { Alert, Platform } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { useFocusEffect } from 'expo-router';

import { dbService } from '@/database/services';
import { AudiobookRecord, PlaybackRecord } from '@/database/types';
import { importService } from '@/features/import/services/import-service';
import { CategoryFilter, SortOption } from '@/features/library/components/LibraryFilterBar';

export interface RecentPlaybackInfo {
  bookId: string;
  title: string;
  author: string | null;
  coverPath: string | null;
  duration: number;
  position: number;
}

export function useLibraryData() {
  const db = useSQLiteContext();

  const [books, setBooks] = useState<AudiobookRecord[]>([]);
  const [playbacksMap, setPlaybacksMap] = useState<Record<string, PlaybackRecord>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [importStage, setImportStage] = useState('');
  const [importPercent, setImportPercent] = useState<number | undefined>(undefined);
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [sortBy, setSortBy] = useState<SortOption>('recent');

  const [recentPlayback, setRecentPlayback] = useState<RecentPlaybackInfo | null>(null);

  // Load books & playbacks from SQLite database
  const loadBooks = useCallback(async () => {
    try {
      const allBooks = await dbService.getAudiobooks(db);
      setBooks(allBooks);

      const allPlaybacks = await dbService.getAllPlaybacks(db);
      const pbMap: Record<string, PlaybackRecord> = {};
      for (const pb of allPlaybacks) {
        pbMap[pb.bookId] = pb;
      }
      setPlaybacksMap(pbMap);

      const recents = await dbService.getRecentPlaybacks(db, 1);
      if (recents.length > 0) {
        const fullBook = await dbService.getAudiobookById(db, recents[0].bookId);
        if (fullBook) {
          setRecentPlayback({
            bookId: fullBook.id,
            title: fullBook.title,
            author: fullBook.author,
            coverPath: fullBook.coverPath,
            duration: fullBook.duration,
            position: recents[0].position,
          });
        }
      } else {
        setRecentPlayback(null);
      }
    } catch (error) {
      console.error('[useLibraryData] Failed to load books:', error);
    }
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      loadBooks();
    }, [loadBooks])
  );

  // Handle file import with progress updates
  const handleImport = useCallback(async () => {
    if (Platform.OS === 'web') {
      const message =
        'Import does not work in the browser.\n\n' +
        '1. In the terminal run: npx expo start\n' +
        '2. Open Expo Go on your phone\n' +
        '3. Scan the QR code\n' +
        '4. Tap Import inside Expo Go';
      if (typeof window !== 'undefined') {
        window.alert(message);
      } else {
        Alert.alert('Use Expo Go on your phone', message);
      }
      return;
    }

    setIsImporting(true);
    setImportStage('Initializing...');
    setImportPercent(0);

    try {
      const imported = await importService.pickAndImportAudiobooks(db, (stage, percent) => {
        setImportStage(stage);
        setImportPercent(percent);
      });

      if (imported && imported.length > 0) {
        await loadBooks();
      }
    } catch (err: any) {
      console.error('[useLibraryData] Import failed:', err);
      Alert.alert('Import Failed', err?.message || 'An unexpected error occurred during import.');
    } finally {
      setIsImporting(false);
      setImportStage('');
      setImportPercent(undefined);
    }
  }, [db, loadBooks]);

  // Filter & Sort books
  const filteredBooks = useMemo(() => {
    return books.filter((b) => {
      const query = searchQuery.toLowerCase().trim();
      if (query) {
        const matchesTitle = b.title.toLowerCase().includes(query);
        const matchesAuthor = b.author?.toLowerCase().includes(query);
        const matchesGenre = b.genre?.toLowerCase().includes(query);
        if (!matchesTitle && !matchesAuthor && !matchesGenre) return false;
      }

      const pb = playbacksMap[b.id];
      const progress = pb && b.duration > 0 ? pb.position / b.duration : 0;
      const isCompleted = pb?.completed === 1 || progress >= 0.99;

      if (categoryFilter === 'in_progress') {
        return progress > 0 && !isCompleted;
      }
      if (categoryFilter === 'completed') {
        return isCompleted;
      }
      if (categoryFilter === 'sci_fi') {
        const g = (b.genre || '').toLowerCase();
        const t = b.title.toLowerCase();
        return g.includes('sci') || g.includes('science') || t.includes('sci-fi') || t.includes('science fiction');
      }
      if (categoryFilter === 'classics') {
        const g = (b.genre || '').toLowerCase();
        const t = b.title.toLowerCase();
        return g.includes('classic') || t.includes('classic');
      }
      if (categoryFilter === 'fiction') {
        const g = (b.genre || '').toLowerCase();
        return g.includes('fiction') && !g.includes('non-fiction') && !g.includes('nonfiction');
      }
      if (categoryFilter === 'non_fiction') {
        const g = (b.genre || '').toLowerCase();
        return g.includes('non-fiction') || g.includes('nonfiction');
      }

      return true;
    });
  }, [books, playbacksMap, searchQuery, categoryFilter]);

  const sortedBooks = useMemo(() => {
    return [...filteredBooks].sort((a, b) => {
      if (sortBy === 'title') {
        return a.title.localeCompare(b.title);
      }
      if (sortBy === 'author') {
        return (a.author || '').localeCompare(b.author || '');
      }
      if (sortBy === 'duration') {
        return b.duration - a.duration;
      }
      const pbA = playbacksMap[a.id]?.lastPlayed || a.createdAt;
      const pbB = playbacksMap[b.id]?.lastPlayed || b.createdAt;
      return pbB.localeCompare(pbA);
    });
  }, [filteredBooks, sortBy, playbacksMap]);

  // Derived Library Statistics
  const completedCount = useMemo(() => {
    return books.filter((b) => {
      const pb = playbacksMap[b.id];
      return pb?.completed === 1 || (pb && b.duration > 0 && pb.position / b.duration >= 0.99);
    }).length;
  }, [books, playbacksMap]);

  const inProgressCount = useMemo(() => {
    return books.filter((b) => {
      const pb = playbacksMap[b.id];
      const p = pb && b.duration > 0 ? pb.position / b.duration : 0;
      return p > 0 && pb?.completed !== 1 && p < 0.99;
    }).length;
  }, [books, playbacksMap]);

  const totalListenedSeconds = useMemo(() => {
    return books.reduce((sum, book) => {
      const pb = playbacksMap[book.id];
      if (!pb) return sum;
      if (pb.completed === 1 || (book.duration > 0 && pb.position / book.duration >= 0.99)) {
        return sum + Math.max(pb.position || 0, book.duration || 0);
      }
      return sum + (pb.position || 0);
    }, 0);
  }, [books, playbacksMap]);

  const streakDays = useMemo(() => {
    const playbacks = Object.values(playbacksMap);
    if (!playbacks.length) return 0;
    const datesSet = new Set<string>();
    for (const pb of playbacks) {
      if (pb.lastPlayed) {
        const dStr = new Date(pb.lastPlayed).toISOString().split('T')[0];
        if (dStr) datesSet.add(dStr);
      }
    }
    if (datesSet.size === 0) return 0;
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    let streak = 0;
    let checkDate: Date;
    if (datesSet.has(todayStr)) {
      checkDate = today;
    } else if (datesSet.has(yesterdayStr)) {
      checkDate = yesterday;
    } else {
      return 0;
    }

    while (true) {
      const dStr = checkDate.toISOString().split('T')[0];
      if (datesSet.has(dStr)) {
        streak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
    }
    return streak;
  }, [playbacksMap]);

  return {
    books,
    playbacksMap,
    recentPlayback,
    searchQuery,
    setSearchQuery,
    categoryFilter,
    setCategoryFilter,
    sortBy,
    setSortBy,
    isImporting,
    importStage,
    importPercent,
    handleImport,
    loadBooks,
    sortedBooks,
    completedCount,
    inProgressCount,
    totalListenedSeconds,
    streakDays,
  };
}
