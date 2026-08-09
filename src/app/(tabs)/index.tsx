import React, { useState, useCallback } from 'react';
import {
  StyleSheet,
  ScrollView,
  Alert,
  Platform,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSQLiteContext } from 'expo-sqlite';
import { useRouter, usePathname, useFocusEffect } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { dbService } from '@/database/services';
import { importService } from '@/features/import/services/import-service';
import { AudiobookRecord, PlaybackRecord } from '@/database/types';
import { Spacing } from '@/constants/theme';
import { usePlaybackStore } from '@/hooks/use-playback-store';
import { usePlayerContext } from '@/features/player/components/playback-provider';
import { navigateToPlayer } from '@/utils/navigation';

import { LibraryHeader } from '@/features/library/components/LibraryHeader';
import { ContinueListeningHero } from '@/features/library/components/ContinueListeningHero';
import { LibraryStatsWidget } from '@/features/library/components/LibraryStatsWidget';
import { LibraryFilterBar, CategoryFilter, ViewMode, SortOption } from '@/features/library/components/LibraryFilterBar';
import { BookGridCard } from '@/features/library/components/BookGridCard';
import { BookListRow } from '@/features/library/components/BookListRow';
import { ImportProgressModal } from '@/features/import/components/ImportProgressModal';

export default function HomeScreen() {
  const db = useSQLiteContext();
  const theme = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  const { startBook } = usePlayerContext();

  const [books, setBooks] = useState<AudiobookRecord[]>([]);
  const [playbacksMap, setPlaybacksMap] = useState<Record<string, PlaybackRecord>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [importStage, setImportStage] = useState('');
  const [importPercent, setImportPercent] = useState<number | undefined>(undefined);
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [sortBy, setSortBy] = useState<SortOption>('recent');

  const [recentPlayback, setRecentPlayback] = useState<{
    bookId: string;
    title: string;
    author: string | null;
    coverPath: string | null;
    duration: number;
    position: number;
  } | null>(null);

  // Load books & playbacks from database
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
      console.error('[HomeScreen] Failed to load books:', error);
    }
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      loadBooks();
    }, [loadBooks])
  );

  // Handle Import with progress callback
  const handleImport = async () => {
    if (Platform.OS === 'web') {
      const message =
        'Import does not work in the browser.\n\n' +
        '1. In the terminal run: npx expo start\n' +
        '2. Open Expo Go on your Android phone\n' +
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
      console.error('[HomeScreen] Import failed:', err);
      Alert.alert('Import Failed', err?.message || 'An unexpected error occurred during import.');
    } finally {
      setIsImporting(false);
      setImportStage('');
      setImportPercent(undefined);
    }
  };

  // Filter & Sort books
  const filteredBooks = books.filter((b) => {
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

    return true;
  });

  const sortedBooks = [...filteredBooks].sort((a, b) => {
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

  const handleOpenBook = (bookId: string) => {
    router.push(`/book/${bookId}`);
  };

  const handlePlayRecent = async () => {
    if (!recentPlayback) return;
    usePlaybackStore.getState().setIsPlayerVisible(true);
    const book = await dbService.getAudiobookById(db, recentPlayback.bookId);
    if (!book) return;
    const chapters = await dbService.getChaptersByBookId(db, book.id);
    await startBook(book, chapters, recentPlayback.position, true);
    navigateToPlayer(router, pathname);
  };

  const completedCount = books.filter((b) => {
    const pb = playbacksMap[b.id];
    return pb?.completed === 1 || (pb && b.duration > 0 && pb.position / b.duration >= 0.99);
  }).length;

  const inProgressCount = books.filter((b) => {
    const pb = playbacksMap[b.id];
    const p = pb && b.duration > 0 ? pb.position / b.duration : 0;
    return p > 0 && pb?.completed !== 1 && p < 0.99;
  }).length;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <LibraryHeader
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        isImporting={isImporting}
        onImport={handleImport}
      />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Continue Listening Hero */}
        <ContinueListeningHero
          recentPlayback={recentPlayback}
          onPlayRecent={handlePlayRecent}
        />

        {/* Library Stats Widget */}
        <LibraryStatsWidget
          totalBooks={books.length}
          inProgressCount={inProgressCount}
          completedCount={completedCount}
        />

        {/* Filter Bar, Sort & View Toggle */}
        <LibraryFilterBar
          activeFilter={categoryFilter}
          onFilterChange={setCategoryFilter}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          sortBy={sortBy}
          onSortChange={setSortBy}
        />

        {/* Books Content Area */}
        <View style={styles.booksSection}>
          {sortedBooks.length === 0 ? (
            <View style={styles.emptyBox}>
              <ThemedText style={styles.emptyTitle}>No Audiobooks Found</ThemedText>
              <ThemedText themeColor="textSecondary" style={styles.emptySubtitle}>
                {searchQuery
                  ? `No audiobooks match "${searchQuery}".`
                  : categoryFilter !== 'all'
                  ? `No audiobooks in "${categoryFilter.replace('_', ' ')}".`
                  : 'Your library is empty. Import your first M4B file to get started.'}
              </ThemedText>
            </View>
          ) : viewMode === 'grid' ? (
            <View style={styles.gridContainer}>
              {sortedBooks.map((book) => (
                <BookGridCard
                  key={book.id}
                  book={book}
                  playback={playbacksMap[book.id]}
                  onPress={() => handleOpenBook(book.id)}
                />
              ))}
            </View>
          ) : (
            <View style={styles.listContainer}>
              {sortedBooks.map((book) => (
                <BookListRow
                  key={book.id}
                  book={book}
                  playback={playbacksMap[book.id]}
                  onPress={() => handleOpenBook(book.id)}
                />
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Import Progress Modal */}
      <ImportProgressModal
        visible={isImporting}
        stage={importStage}
        percent={importPercent}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 80,
  },
  booksSection: {
    paddingHorizontal: Spacing.four,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  listContainer: {
    gap: 8,
  },
  emptyBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});
