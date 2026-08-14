import { usePathname, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { dbService } from '@/database/services';
import { usePlayerContext } from '@/features/player/components/playback-provider';
import { usePlaybackStore } from '@/hooks/use-playback-store';
import { useTheme } from '@/hooks/use-theme';
import { useLibraryData } from '@/hooks/use-library-data';
import { navigateToPlayer } from '@/utils/navigation';

import { ImportProgressModal } from '@/features/import/components/ImportProgressModal';
import { BookGridCard } from '@/features/library/components/BookGridCard';
import { ContinueListeningHero } from '@/features/library/components/ContinueListeningHero';
import { LibraryFilterBar } from '@/features/library/components/LibraryFilterBar';
import { LibraryHeader } from '@/features/library/components/LibraryHeader';
import { LibraryStatsWidget } from '@/features/library/components/LibraryStatsWidget';

export default function HomeScreen() {
  const db = useSQLiteContext();
  const theme = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  const { startBook } = usePlayerContext();

  const {
    books,
    playbacksMap,
    recentPlayback,
    searchQuery,
    setSearchQuery,
    categoryFilter,
    setCategoryFilter,
    isImporting,
    importStage,
    importPercent,
    handleImport,
    sortedBooks,
    completedCount,
    totalListenedSeconds,
    streakDays,
  } = useLibraryData();

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

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <LibraryHeader
        isImporting={isImporting}
        onImport={handleImport}
        showSearchBar={false}
      />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Continue Listening Hero */}
        <ContinueListeningHero
          recentPlayback={recentPlayback}
          onPlayRecent={handlePlayRecent}
        />

        {/* Library Stats Widget ("Your Insights") */}
        <LibraryStatsWidget
          totalBooks={books.length}
          completedCount={completedCount}
          totalListenedSeconds={totalListenedSeconds}
          streakDays={streakDays}
        />

        {/* Library Section Header, Search Bar & Category Filter Buttons */}
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
    paddingBottom: 160,
  },
  booksSection: {
    paddingHorizontal: Spacing.four,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
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
