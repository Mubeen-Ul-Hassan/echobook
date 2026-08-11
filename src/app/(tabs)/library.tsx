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

import { LibraryHeader } from '@/features/library/components/LibraryHeader';
import { LibraryFilterBar, CategoryFilter, SortOption } from '@/features/library/components/LibraryFilterBar';
import { BookGridCard } from '@/features/library/components/BookGridCard';
import { ImportProgressModal } from '@/features/import/components/ImportProgressModal';

export default function LibraryScreen() {
  const db = useSQLiteContext();
  const theme = useTheme();
  const router = useRouter();

  const [books, setBooks] = useState<AudiobookRecord[]>([]);
  const [playbacksMap, setPlaybacksMap] = useState<Record<string, PlaybackRecord>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [importStage, setImportStage] = useState('');
  const [importPercent, setImportPercent] = useState<number | undefined>(undefined);
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [sortBy, setSortBy] = useState<SortOption>('recent');

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
    } catch (error) {
      console.error('[LibraryScreen] Failed to load books:', error);
    }
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      loadBooks();
    }, [loadBooks])
  );

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
      console.error('[LibraryScreen] Import failed:', err);
      Alert.alert('Import Failed', err?.message || 'An unexpected error occurred during import.');
    } finally {
      setIsImporting(false);
      setImportStage('');
      setImportPercent(undefined);
    }
  };

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

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <LibraryHeader
        isImporting={isImporting}
        onImport={handleImport}
        showSearchBar={false}
      />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Filter Bar & Search */}
        <LibraryFilterBar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          activeFilter={categoryFilter}
          onFilterChange={setCategoryFilter}
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
          ) : (
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
          )}
        </View>
      </ScrollView>

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
    paddingBottom: 160,
  },
  booksSection: {
    paddingHorizontal: Spacing.four,
    marginTop: Spacing.two,
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
