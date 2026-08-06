import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Pressable,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
  Dimensions,
  Platform,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSQLiteContext } from 'expo-sqlite';
import { Image } from 'expo-image';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { dbService } from '@/database/services';
import { importService } from '@/features/import/services/import-service';
import { AudiobookRecord, PlaybackRecord } from '@/database/types';
import { Spacing } from '@/constants/theme';
import { usePlaybackStore } from '@/hooks/use-playback-store';

const { width } = Dimensions.get('window');
const COLUMN_WIDTH = (width - Spacing.four * 2 - Spacing.three) / 2;

type CategoryFilter = 'all' | 'in_progress' | 'completed';
type ViewMode = 'grid' | 'list';

export default function HomeScreen() {
  const db = useSQLiteContext();
  const theme = useTheme();
  const router = useRouter();

  // Component State
  const [books, setBooks] = useState<AudiobookRecord[]>([]);
  const [playbacksMap, setPlaybacksMap] = useState<Record<string, PlaybackRecord>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');

  // Playback state from store
  const {
    setCurrentBook,
    setPosition,
    setCurrentChapter,
    setChapters,
    setSpeed,
  } = usePlaybackStore();

  const [recentPlayback, setRecentPlayback] = useState<
    (PlaybackRecord & { title: string; author: string | null; coverPath: string | null; duration: number }) | null
  >(null);

  // Load books & playbacks from database
  const loadBooks = useCallback(async () => {
    try {
      const allBooks = await dbService.getAudiobooks(db);
      setBooks(allBooks);

      // Fetch all playback states in a single batch query
      const allPlaybacks = await dbService.getAllPlaybacks(db);
      const pbMap: Record<string, PlaybackRecord> = {};
      for (const pb of allPlaybacks) {
        pbMap[pb.bookId] = pb;
      }
      setPlaybacksMap(pbMap);

      // Get the most recent playback
      const recents = await dbService.getRecentPlaybacks(db, 1);
      if (recents.length > 0) {
        const fullBook = await dbService.getAudiobookById(db, recents[0].bookId);
        if (fullBook) {
          setRecentPlayback({
            ...recents[0],
            duration: fullBook.duration,
          });
        }
      } else {
        setRecentPlayback(null);
      }
    } catch (error) {
      console.error('Failed to load books:', error);
    }
  }, [db]);

  useEffect(() => {
    loadBooks();
  }, [loadBooks]);

  // Handle Import
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
    try {
      const imported = await importService.pickAndImportAudiobooks(db);
      if (imported === null) {
        // User canceled file picker
        return;
      }
      if (imported.length > 0) {
        await loadBooks();
        Alert.alert(
          'Imported',
          `Added ${imported.length} audiobook${imported.length === 1 ? '' : 's'} to your library.`,
        );
      } else {
        Alert.alert(
          'Nothing imported',
          'No supported files were added. Pick a .m4b, .m4a, or .mp4 audiobook.',
        );
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Something went wrong while importing. Please try again.';
      Alert.alert('Import failed', message);
    } finally {
      setIsImporting(false);
    }
  };

  // Handle Continue / Play
  const handleStartBook = async (bookId: string) => {
    try {
      const book = await dbService.getAudiobookById(db, bookId);
      if (book) {
        const [playback, bookChapters] = await Promise.all([
          dbService.getPlayback(db, bookId),
          dbService.getChaptersByBookId(db, bookId),
        ]);

        setCurrentBook(book);
        setChapters(bookChapters);

        if (playback) {
          setPosition(playback.position);
          const activeChapter =
            bookChapters.find((ch) => ch.id === playback.chapterId) || bookChapters[0] || null;
          setCurrentChapter(activeChapter);
          if (playback.speed) setSpeed(playback.speed);
        } else {
          setPosition(0);
          setCurrentChapter(bookChapters[0] || null);
          setSpeed(1.0);
        }

        router.push('/player');
      }
    } catch (error) {
      console.error('Failed to start playback:', error);
    }
  };

  // Filter books based on search & category
  const filteredBooks = books.filter((book) => {
    const query = searchQuery.toLowerCase();
    const matchesSearch =
      book.title.toLowerCase().includes(query) ||
      (book.author && book.author.toLowerCase().includes(query)) ||
      (book.genre && book.genre.toLowerCase().includes(query));

    if (!matchesSearch) return false;

    const pb = playbacksMap[book.id];
    if (categoryFilter === 'in_progress') {
      return pb && pb.position > 0 && pb.completed === 0;
    }
    if (categoryFilter === 'completed') {
      return pb && pb.completed === 1;
    }
    return true;
  });

  // Formatting helpers
  const formatTimeRemaining = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0) return `${h}h ${m}m remaining`;
    return `${m}m remaining`;
  };

  const formatDuration = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0) return `${h}h ${m}`;
    return `${m}m`;
  };

  const getBookProgressRatio = (bookId: string, duration: number) => {
    const pb = playbacksMap[bookId];
    if (!pb || duration <= 0) return 0;
    return Math.min(1, Math.max(0, pb.position / duration));
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top', 'left', 'right']}>
      {/* ── Brand Header Bar ── */}
      <View style={styles.header}>
        <View style={styles.brandRow}>
          <View style={[styles.logoIcon, { backgroundColor: theme.accent }]}>
            <MaterialIcons name="headphones" size={20} color="#000" />
          </View>
          <View>
            <ThemedText style={styles.appName}>EchoBook</ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.appSub}>
              {books.length} {books.length === 1 ? 'audiobook' : 'audiobooks'}
            </ThemedText>
          </View>
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.importButton,
            { backgroundColor: theme.accent, opacity: pressed ? 0.85 : 1 },
          ]}
          onPress={handleImport}
          disabled={isImporting}
          accessibilityRole="button"
          accessibilityLabel="Import audiobook"
        >
          {isImporting ? (
            <ActivityIndicator size="small" color="#000" />
          ) : (
            <>
              <MaterialIcons name="add" size={18} color="#000" />
              <ThemedText style={styles.importButtonText}>Import</ThemedText>
            </>
          )}
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Search Bar ── */}
        <Animated.View entering={FadeInDown.duration(300)} style={[styles.searchContainer, { backgroundColor: theme.backgroundElement }]}>
          <MaterialIcons name="search" size={20} color={theme.textSecondary} style={styles.searchIcon} />
          <TextInput
            style={[styles.searchInput, { color: theme.text }]}
            placeholder="Search audiobooks, authors..."
            placeholderTextColor={theme.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            keyboardAppearance="dark"
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery('')} hitSlop={8}>
              <MaterialIcons name="close" size={18} color={theme.textSecondary} />
            </Pressable>
          )}
        </Animated.View>

        {/* ── Continue Listening Section ── */}
        {recentPlayback && !searchQuery && (
          <Animated.View entering={FadeInDown.delay(100).duration(300)} style={styles.sectionContainer}>
            <View style={styles.sectionHeaderRow}>
              <MaterialIcons name="auto-awesome" size={16} color={theme.accent} style={{ marginRight: 6 }} />
              <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionTitleText}>
                CONTINUE LISTENING
              </ThemedText>
            </View>
            <Pressable
              onPress={() => handleStartBook(recentPlayback.bookId)}
              style={({ pressed }) => [
                styles.continueCard,
                {
                  backgroundColor: theme.backgroundElement,
                  borderColor: theme.border,
                  borderWidth: 1,
                  opacity: pressed ? 0.92 : 1,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel={`Continue listening to ${recentPlayback.title}`}
            >
              {recentPlayback.coverPath ? (
                <Image source={{ uri: recentPlayback.coverPath }} style={styles.continueCover} />
              ) : (
                <View style={[styles.continueCoverPlaceholder, { backgroundColor: theme.backgroundSelected }]}>
                  <MaterialIcons name="graphic-eq" size={28} color={theme.textSecondary} />
                </View>
              )}

              <View style={styles.continueInfo}>
                <ThemedText numberOfLines={1} style={styles.continueBookTitle}>
                  {recentPlayback.title}
                </ThemedText>
                <ThemedText numberOfLines={1} themeColor="textSecondary" style={styles.continueAuthor}>
                  {recentPlayback.author || 'Unknown Author'}
                </ThemedText>

                <View style={styles.continueProgressRow}>
                  <MaterialIcons name="access-time" size={14} color={theme.accent} style={{ marginRight: 4 }} />
                  <ThemedText type="small" style={{ color: theme.accent, fontWeight: '600' }}>
                    {formatTimeRemaining(recentPlayback.duration - recentPlayback.position)}
                  </ThemedText>
                </View>

                {/* Smooth Progress Bar */}
                <View style={[styles.progressBarBg, { backgroundColor: theme.backgroundSelected }]}>
                  <View
                    style={[
                      styles.progressBarFill,
                      {
                        backgroundColor: theme.accent,
                        width: `${Math.min(100, Math.max(2, (recentPlayback.position / recentPlayback.duration) * 100))}%`,
                      },
                    ]}
                  />
                </View>
              </View>

              <Pressable
                style={[styles.continuePlayButton, { backgroundColor: theme.accent }]}
                onPress={() => handleStartBook(recentPlayback.bookId)}
              >
                <MaterialIcons name="play-arrow" size={22} color="#000" />
              </Pressable>
            </Pressable>
          </Animated.View>
        )}



        {/* ── All Audiobooks Section ── */}
        <Animated.View entering={FadeInDown.delay(200).duration(300)} style={styles.sectionContainer}>
          <View style={styles.catalogHeader}>
            <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionTitleText}>
              {searchQuery ? 'SEARCH RESULTS' : 'AUDIOBOOKS'}
            </ThemedText>

            {/* View Mode Toggle: Grid vs List */}
            <View style={[styles.viewToggleGroup, { backgroundColor: theme.backgroundElement }]}>
              <Pressable
                onPress={() => setViewMode('grid')}
                style={[
                  styles.toggleBtn,
                  viewMode === 'grid' && { backgroundColor: theme.backgroundSelected },
                ]}
              >
                <MaterialIcons name="grid-view" size={18} color={viewMode === 'grid' ? theme.accent : theme.textSecondary} />
              </Pressable>
              <Pressable
                onPress={() => setViewMode('list')}
                style={[
                  styles.toggleBtn,
                  viewMode === 'list' && { backgroundColor: theme.backgroundSelected },
                ]}
              >
                <MaterialIcons name="format-list-bulleted" size={18} color={viewMode === 'list' ? theme.accent : theme.textSecondary} />
              </Pressable>
            </View>
          </View>

          {/* Category Filter Chips */}
          {!searchQuery && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
              {(['all', 'in_progress', 'completed'] as CategoryFilter[]).map((cat) => {
                const isActive = categoryFilter === cat;
                const label =
                  cat === 'all'
                    ? 'All'
                    : cat === 'in_progress'
                    ? 'In Progress'
                    : 'Completed';
                return (
                  <Pressable
                    key={cat}
                    onPress={() => setCategoryFilter(cat)}
                    style={[
                      styles.filterChip,
                      {
                        backgroundColor: isActive ? theme.accent : theme.backgroundElement,
                      },
                    ]}
                  >
                    <ThemedText
                      style={[
                        styles.filterChipText,
                        { color: isActive ? '#000' : theme.textSecondary },
                      ]}
                    >
                      {label}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </ScrollView>
          )}

          {/* Audiobooks Content */}
          {filteredBooks.length === 0 ? (
            <Animated.View
              entering={FadeInDown.duration(300)}
              style={[
                styles.emptyContainer,
                {
                  backgroundColor: theme.backgroundElement,
                  borderColor: theme.border,
                  borderWidth: 1,
                },
              ]}
            >
              {/* Branded Icon Container */}
              <View
                style={[
                  styles.emptyIconCircle,
                  {
                    backgroundColor: theme.accent + '15',
                    borderColor: theme.accent + '35',
                  },
                ]}
              >
                {searchQuery ? (
                  <MaterialIcons name="search-off" size={30} color={theme.accent} />
                ) : categoryFilter === 'in_progress' ? (
                  <MaterialIcons name="play-circle-outline" size={30} color={theme.accent} />
                ) : categoryFilter === 'completed' ? (
                  <MaterialIcons name="check-circle-outline" size={30} color={theme.accent} />
                ) : (
                  <MaterialIcons name="headphones" size={30} color={theme.accent} />
                )}
              </View>

              {/* Title & Description */}
              <ThemedText style={styles.emptyTitle}>
                {searchQuery
                  ? 'No Matching Audiobooks'
                  : categoryFilter === 'in_progress'
                  ? 'No Audiobooks in Progress'
                  : categoryFilter === 'completed'
                  ? 'No Completed Audiobooks'
                  : 'Your Library is Empty'}
              </ThemedText>

              <ThemedText themeColor="textSecondary" style={styles.emptySubtitle}>
                {searchQuery
                  ? `No audiobooks match "${searchQuery}". Try searching with a different term.`
                  : categoryFilter === 'in_progress'
                  ? 'You have not started listening to any audiobooks in your library yet.'
                  : categoryFilter === 'completed'
                  ? 'You have not completed listening to any audiobooks yet.'
                  : 'Import your local M4B, MP3, or M4A audiobooks to start listening.'}
              </ThemedText>

              {/* Action Button */}
              {searchQuery ? (
                <Pressable
                  onPress={() => setSearchQuery('')}
                  style={({ pressed }) => [
                    styles.emptyActionBtn,
                    { backgroundColor: theme.backgroundSelected, opacity: pressed ? 0.8 : 1 },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Clear search query"
                >
                  <MaterialIcons name="close" size={16} color={theme.text} />
                  <ThemedText style={styles.emptyActionBtnText}>Clear Search</ThemedText>
                </Pressable>
              ) : categoryFilter !== 'all' ? (
                <Pressable
                  onPress={() => setCategoryFilter('all')}
                  style={({ pressed }) => [
                    styles.emptyActionBtn,
                    { backgroundColor: theme.accent, opacity: pressed ? 0.85 : 1 },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Show all audiobooks"
                >
                  <MaterialIcons name="library-books" size={16} color="#000" />
                  <ThemedText style={[styles.emptyActionBtnText, { color: '#000' }]}>
                    Show All Audiobooks
                  </ThemedText>
                </Pressable>
              ) : (
                <Pressable
                  onPress={handleImport}
                  disabled={isImporting}
                  style={({ pressed }) => [
                    styles.emptyActionBtn,
                    { backgroundColor: theme.accent, opacity: pressed ? 0.85 : 1 },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Import audiobook"
                >
                  {isImporting ? (
                    <ActivityIndicator size="small" color="#000" />
                  ) : (
                    <>
                      <MaterialIcons name="add" size={18} color="#000" />
                      <ThemedText style={[styles.emptyActionBtnText, { color: '#000' }]}>
                        Import Audiobook
                      </ThemedText>
                    </>
                  )}
                </Pressable>
              )}
            </Animated.View>
          ) : viewMode === 'grid' ? (
            /* --- GRID VIEW --- */
            <View style={styles.grid}>
              {filteredBooks.map((book) => {
                const ratio = getBookProgressRatio(book.id, book.duration);
                const pb = playbacksMap[book.id];
                const isDone = pb?.completed === 1;

                return (
                  <Pressable
                    key={book.id}
                    style={({ pressed }) => [
                      styles.gridCard,
                      { backgroundColor: theme.backgroundElement, opacity: pressed ? 0.88 : 1 },
                    ]}
                    onPress={() => router.push(`/book/${book.id}` as Href)}
                  >
                    <View style={styles.gridCoverContainer}>
                      {book.coverPath ? (
                        <Image source={{ uri: book.coverPath }} style={styles.gridCover} />
                      ) : (
                        <View style={[styles.gridCoverPlaceholder, { backgroundColor: theme.backgroundSelected }]}>
                          <MaterialIcons name="graphic-eq" size={36} color={theme.textSecondary} />
                        </View>
                      )}

                      {/* Play overlay badge */}
                      <Pressable
                        style={[styles.gridPlayBadge, { backgroundColor: theme.accent }]}
                        onPress={() => handleStartBook(book.id)}
                      >
                        <MaterialIcons name="play-arrow" size={16} color="#000" />
                      </Pressable>

                      {isDone && (
                        <View style={styles.doneBadge}>
                          <MaterialIcons name="check-circle" size={16} color="#4ADE80" />
                        </View>
                      )}
                    </View>

                    <View style={styles.gridInfo}>
                      <ThemedText numberOfLines={1} style={styles.gridBookTitle}>
                        {book.title}
                      </ThemedText>
                      <ThemedText numberOfLines={1} type="small" themeColor="textSecondary" style={styles.gridAuthor}>
                        {book.author || 'Unknown Author'}
                      </ThemedText>
                      <View style={styles.gridMetaRow}>
                        <ThemedText type="small" themeColor="textSecondary">
                          {formatDuration(book.duration)}
                        </ThemedText>
                      </View>

                      {/* Progress Bar */}
                      {ratio > 0 && (
                        <View style={[styles.cardProgressBg, { backgroundColor: theme.backgroundSelected }]}>
                          <View style={[styles.cardProgressFill, { backgroundColor: theme.accent, width: `${ratio * 100}%` }]} />
                        </View>
                      )}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ) : (
            /* --- LIST VIEW --- */
            <View style={styles.listContainer}>
              {filteredBooks.map((book) => {
                const ratio = getBookProgressRatio(book.id, book.duration);
                const pb = playbacksMap[book.id];
                const isDone = pb?.completed === 1;

                return (
                  <Pressable
                    key={book.id}
                    style={({ pressed }) => [
                      styles.listRow,
                      { backgroundColor: theme.backgroundElement, opacity: pressed ? 0.88 : 1 },
                    ]}
                    onPress={() => router.push(`/book/${book.id}` as Href)}
                  >
                    {book.coverPath ? (
                      <Image source={{ uri: book.coverPath }} style={styles.listCover} />
                    ) : (
                      <View style={[styles.listCoverPlaceholder, { backgroundColor: theme.backgroundSelected }]}>
                        <MaterialIcons name="graphic-eq" size={22} color={theme.textSecondary} />
                      </View>
                    )}

                    <View style={styles.listInfo}>
                      <ThemedText numberOfLines={1} style={styles.listTitle}>
                        {book.title}
                      </ThemedText>
                      <ThemedText numberOfLines={1} type="small" themeColor="textSecondary">
                        {book.author || 'Unknown Author'} · {formatDuration(book.duration)}
                      </ThemedText>

                      {ratio > 0 && (
                        <View style={[styles.listProgressBg, { backgroundColor: theme.backgroundSelected }]}>
                          <View style={[styles.listProgressFill, { backgroundColor: theme.accent, width: `${ratio * 100}%` }]} />
                        </View>
                      )}
                    </View>

                    <Pressable
                      style={[styles.listPlayBtn, { backgroundColor: theme.accent }]}
                      onPress={() => handleStartBook(book.id)}
                    >
                      <MaterialIcons name="play-arrow" size={16} color="#000" />
                    </Pressable>
                  </Pressable>
                );
              })}
            </View>
          )}
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  // Brand Header Bar
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.three,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two + 2,
  },
  logoIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appName: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  appSub: {
    fontSize: 12,
    marginTop: -1,
  },
  importButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.three + 2,
    paddingVertical: Spacing.two,
    borderRadius: 100,
    gap: 6,
  },
  importButtonText: {
    fontWeight: '700',
    fontSize: 13,
    color: '#000',
  },

  scrollContent: {
    paddingBottom: Spacing.six,
  },

  // Search
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: Spacing.four,
    marginBottom: Spacing.four,
    paddingHorizontal: Spacing.three,
    paddingVertical: Platform.OS === 'ios' ? Spacing.two : Spacing.one + 2,
    borderRadius: Spacing.three,
  },
  searchIcon: {
    marginRight: Spacing.two,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 2,
  },

  // Section general
  sectionContainer: {
    marginBottom: Spacing.five,
    paddingHorizontal: Spacing.four,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.two,
  },
  sectionTitleText: {
    letterSpacing: 1.2,
    fontSize: 12,
    fontWeight: '700',
  },

  // Continue Listening Card
  continueCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.three,
    borderRadius: 18,
    position: 'relative',
    marginTop: 4,
  },
  continueCover: {
    width: 68,
    height: 68,
    borderRadius: 12,
  },
  continueCoverPlaceholder: {
    width: 68,
    height: 68,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueInfo: {
    flex: 1,
    marginLeft: Spacing.three,
    paddingRight: 44,
  },
  continueBookTitle: {
    fontWeight: '700',
    fontSize: 16,
  },
  continueAuthor: {
    fontSize: 13,
    marginTop: 2,
  },
  continueProgressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  progressBarBg: {
    height: 4,
    borderRadius: 2,
    marginTop: 8,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  continuePlayButton: {
    position: 'absolute',
    right: Spacing.three,
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Recently Added Shelf
  recentShelf: {
    gap: Spacing.three,
    paddingTop: Spacing.two,
  },
  recentCard: {
    width: 140,
  },
  recentCoverWrapper: {
    position: 'relative',
    marginBottom: Spacing.two,
  },
  recentCover: {
    width: 140,
    height: 140,
    borderRadius: 16,
  },
  recentCoverPlaceholder: {
    width: 140,
    height: 140,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  durationBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: '#000000AA',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  durationBadgeText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '600',
  },
  recentBookTitle: {
    fontWeight: '700',
    fontSize: 14,
  },

  // Catalog Section & Controls
  catalogHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.two,
  },
  viewToggleGroup: {
    flexDirection: 'row',
    borderRadius: 8,
    padding: 2,
  },
  toggleBtn: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
  },

  // Filter Chips
  filterRow: {
    gap: Spacing.two,
    marginBottom: Spacing.three,
    paddingVertical: 2,
  },
  filterChip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: 6,
    borderRadius: 100,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '600',
  },

  // Redesigned Empty state
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.six,
    paddingHorizontal: Spacing.five,
    borderRadius: 24,
    marginTop: Spacing.three,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 4,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.three,
    borderWidth: 1,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 6,
    letterSpacing: -0.2,
  },
  emptySubtitle: {
    textAlign: 'center',
    fontSize: 13,
    lineHeight: 19,
    maxWidth: 280,
    marginBottom: Spacing.four,
  },
  emptyActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one + 2,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two + 2,
    borderRadius: 100,
  },
  emptyActionBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },

  // Grid View
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
    marginTop: Spacing.one,
  },
  gridCard: {
    width: COLUMN_WIDTH,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 2,
  },
  gridCoverContainer: {
    position: 'relative',
  },
  gridCover: {
    width: COLUMN_WIDTH,
    height: COLUMN_WIDTH * 0.95,
  },
  gridCoverPlaceholder: {
    width: COLUMN_WIDTH,
    height: COLUMN_WIDTH * 0.95,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridPlayBadge: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  doneBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: '#00000099',
    borderRadius: 10,
    padding: 3,
  },
  gridInfo: {
    padding: Spacing.three,
  },
  gridBookTitle: {
    fontWeight: '700',
    fontSize: 14,
  },
  gridAuthor: {
    marginTop: 2,
    fontSize: 12,
  },
  gridMetaRow: {
    marginTop: 4,
  },
  cardProgressBg: {
    height: 3,
    borderRadius: 1.5,
    marginTop: 8,
    overflow: 'hidden',
  },
  cardProgressFill: {
    height: '100%',
    borderRadius: 1.5,
  },

  // List View
  listContainer: {
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.two + 2,
    borderRadius: 14,
  },
  listCover: {
    width: 52,
    height: 52,
    borderRadius: 10,
  },
  listCoverPlaceholder: {
    width: 52,
    height: 52,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listInfo: {
    flex: 1,
    marginLeft: Spacing.three,
    marginRight: Spacing.two,
  },
  listTitle: {
    fontWeight: '700',
    fontSize: 15,
  },
  listProgressBg: {
    height: 3,
    borderRadius: 1.5,
    marginTop: 6,
    overflow: 'hidden',
  },
  listProgressFill: {
    height: '100%',
    borderRadius: 1.5,
  },
  listPlayBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
