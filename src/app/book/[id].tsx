import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Pressable,
  ScrollView,
  Dimensions,
  View,
  Alert,
} from 'react-native';
import { preload } from 'expo-audio';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSQLiteContext } from 'expo-sqlite';
import { Image } from 'expo-image';
import { MaterialIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';
import { dbService } from '@/database/services';
import { importService } from '@/features/import/services/import-service';
import { AudiobookRecord, ChapterRecord, PlaybackRecord, BookmarkRecord } from '@/database/types';
import { Spacing } from '@/constants/theme';
import { usePlaybackStore } from '@/hooks/use-playback-store';

const { width } = Dimensions.get('window');
const COVER_SIZE = width * 0.55;

export default function BookDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useSQLiteContext();
  const theme = useTheme();
  const router = useRouter();

  const {
    setCurrentBook,
    setCurrentChapter,
    setPosition,
    setSpeed,
    setChapters: setStoreChapters,
  } = usePlaybackStore();

  const [book, setBook] = useState<AudiobookRecord | null>(null);
  const [chapters, setChapters] = useState<ChapterRecord[]>([]);
  const [playback, setPlayback] = useState<PlaybackRecord | null>(null);
  const [bookmarks, setBookmarks] = useState<BookmarkRecord[]>([]);
  const [activeTab, setActiveTab] = useState<'chapters' | 'bookmarks'>('chapters');
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!id) return;
    setLoadError(null);
    try {
      const [bookData, chaptersData, playbackData, bookmarksData] = await Promise.all([
        dbService.getAudiobookById(db, id),
        dbService.getChaptersByBookId(db, id),
        dbService.getPlayback(db, id),
        dbService.getBookmarksByBookId(db, id),
      ]);
      setBook(bookData);
      setChapters(chaptersData);
      setPlayback(playbackData);
      setBookmarks(bookmarksData);

      // Check if metadata (cover image / chapters) can be repaired/extracted asynchronously
      if (bookData) {
        importService
          .repairOrRefreshBookMetadata(db, id)
          .then(({ audiobook, chapters: refreshedChapters }) => {
            if (audiobook) setBook(audiobook);
            if (refreshedChapters.length > 0) setChapters(refreshedChapters);
          })
          .catch(console.warn);
      }

      // Preload the audio file in the background so the player starts in < 150 ms
      if (bookData?.audioPath) {
        preload({ uri: bookData.audioPath }).catch(() => {
          // Preload failure is non-fatal; playback will still work
        });
      }

      if (!bookData) {
        setLoadError('Book not found. It may have been removed.');
      }
    } catch (error) {
      console.error('Failed to load book data:', error);
      setLoadError('Failed to load book details. Please try again.');
    }
  }, [db, id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // --- Helpers ---

  const formatDuration = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  };

  const formatTimestamp = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    const pad = (n: number) => n.toString().padStart(2, '0');
    if (h > 0) return `${h}:${pad(m)}:${pad(s)}`;
    return `${m}:${pad(s)}`;
  };

  const getProgress = () => {
    if (!book || !playback || book.duration === 0) return 0;
    return Math.min(1, playback.position / book.duration);
  };

  const getChapterProgress = (chapter: ChapterRecord) => {
    if (!playback) return 0;
    if (playback.position >= chapter.endTime) return 1;
    if (playback.position <= chapter.startTime) return 0;
    return (playback.position - chapter.startTime) / (chapter.endTime - chapter.startTime);
  };

  const isChapterActive = (chapter: ChapterRecord) => {
    if (!playback) return false;
    return playback.position >= chapter.startTime && playback.position < chapter.endTime;
  };

  // --- Actions ---

  const handlePlay = (chapter?: ChapterRecord) => {
    if (!book) return;
    setCurrentBook(book);
    setStoreChapters(chapters);

    if (chapter) {
      setCurrentChapter(chapter);
      setPosition(chapter.startTime);
    } else if (playback) {
      const activeChapter = chapters.find(ch => ch.id === playback.chapterId) || chapters[0] || null;
      setCurrentChapter(activeChapter);
      setPosition(playback.position);
      if (playback.speed) setSpeed(playback.speed);
    } else {
      setCurrentChapter(chapters[0] || null);
      setPosition(0);
    }

    router.push('/player');
  };

  const handleStartOver = () => {
    if (!book) return;
    setCurrentBook(book);
    setStoreChapters(chapters);
    setCurrentChapter(chapters[0] || null);
    setPosition(0);
    router.push('/player');
  };

  if (!book) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.loadingContainer}>
          {loadError ? (
            <>
              <ThemedText themeColor="textSecondary" style={{ textAlign: 'center', marginBottom: 12 }}>
                {loadError}
              </ThemedText>
              <Pressable
                onPress={() => router.back()}
                style={[styles.errorBackBtn, { backgroundColor: theme.backgroundElement }]}
                accessibilityRole="button"
                accessibilityLabel="Go back to library"
              >
                <ThemedText>Go Back</ThemedText>
              </Pressable>
            </>
          ) : (
            <ThemedText themeColor="textSecondary">Loading...</ThemedText>
          )}
        </View>
      </SafeAreaView>
    );
  }

  const progress = getProgress();

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Cover Art Hero */}
        <Animated.View entering={FadeIn.duration(400)} style={styles.heroSection}>
          {/* Back Button */}
          <SafeAreaView edges={['top']} style={styles.backButtonSafeArea}>
            <Pressable
              onPress={() => router.back()}
              style={({ pressed }) => [
                styles.backButton,
                { backgroundColor: pressed ? theme.backgroundSelected : theme.backgroundElement + 'CC' },
              ]}
              hitSlop={12}
            >
              <MaterialIcons name="arrow-back" size={20} color={theme.text} />
            </Pressable>
          </SafeAreaView>

          {/* Cover */}
          <View style={styles.coverContainer}>
            {book.coverPath ? (
              <Image
                source={{ uri: book.coverPath }}
                style={styles.coverImage}
                contentFit="cover"
              />
            ) : (
              <View style={[styles.coverPlaceholder, { backgroundColor: theme.backgroundElement }]}>
                <MaterialIcons name="graphic-eq" size={64} color={theme.textSecondary} />
              </View>
            )}
          </View>
        </Animated.View>

        {/* Metadata Section */}
        <Animated.View entering={FadeInDown.delay(100).duration(400)} style={styles.metaSection}>
          <ThemedText style={styles.bookTitle} numberOfLines={2}>
            {book.title}
          </ThemedText>

          {book.author && (
            <View style={styles.metaRow}>
              <MaterialIcons name="person" size={16} color={theme.accent} />
              <ThemedText themeColor="textSecondary" style={styles.metaText}>
                {book.author}
              </ThemedText>
            </View>
          )}

          {book.album && (
            <View style={styles.metaRow}>
              <MaterialIcons name="album" size={16} color={theme.textSecondary} />
              <ThemedText themeColor="textSecondary" style={styles.metaText}>
                {book.album}
              </ThemedText>
            </View>
          )}

          {/* Genre Bullet Items */}
          {book.genre && (
            <View style={styles.genreContainer}>
              {book.genre.split(',').map((g, idx) => (
                <View key={idx} style={styles.genreBulletItem}>
                  <MaterialIcons name="circle" size={6} color={theme.accent} />
                  <ThemedText style={[styles.genreBulletText, { color: theme.accent }]}>
                    {g.trim()}
                  </ThemedText>
                </View>
              ))}
            </View>
          )}

          <View style={styles.metaChips}>
            <View style={[styles.chip, { backgroundColor: theme.backgroundElement }]}>
              <MaterialIcons name="access-time" size={14} color={theme.textSecondary} />
              <ThemedText type="small" themeColor="textSecondary">{formatDuration(book.duration)}</ThemedText>
            </View>
            <View style={[styles.chip, { backgroundColor: theme.backgroundElement }]}>
              <MaterialIcons name="format-list-bulleted" size={14} color={theme.textSecondary} />
              <ThemedText type="small" themeColor="textSecondary">
                {chapters.length} {chapters.length === 1 ? 'chapter' : 'chapters'}
              </ThemedText>
            </View>
            {book.year && (
              <View style={[styles.chip, { backgroundColor: theme.backgroundElement }]}>
                <MaterialIcons name="calendar-today" size={14} color={theme.textSecondary} />
                <ThemedText type="small" themeColor="textSecondary">{book.year}</ThemedText>
              </View>
            )}
          </View>

          {/* Overall Progress */}
          {playback && playback.position > 0 && (
            <View style={styles.overallProgress}>
              <View style={styles.progressLabelRow}>
                <ThemedText type="small" themeColor="textSecondary">
                  {Math.round(progress * 100)}% complete
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {formatDuration(book.duration - playback.position)} left
                </ThemedText>
              </View>
              <View style={[styles.progressBarBg, { backgroundColor: theme.backgroundElement }]}>
                <View
                  style={[styles.progressBarFill, { backgroundColor: theme.accent, width: `${progress * 100}%` }]}
                />
              </View>
            </View>
          )}
        </Animated.View>

        {/* Action Buttons */}
        <Animated.View entering={FadeInDown.delay(200).duration(400)} style={styles.actionsSection}>
          <Pressable
            style={({ pressed }) => [
              styles.primaryButton,
              { backgroundColor: pressed ? '#E06E00' : theme.accent },
            ]}
            onPress={() => handlePlay()}
            accessibilityRole="button"
            accessibilityLabel={playback && playback.position > 0 ? `Resume ${book.title}` : `Play ${book.title}`}
          >
            <MaterialIcons name="play-arrow" size={22} color="#000" />
            <ThemedText style={styles.primaryButtonText}>
              {playback && playback.position > 0 ? 'Resume' : 'Play'}
            </ThemedText>
          </Pressable>

          {playback && playback.position > 0 && (
            <Pressable
              style={({ pressed }) => [
                styles.secondaryButton,
                { backgroundColor: pressed ? theme.backgroundSelected : theme.backgroundElement },
              ]}
              onPress={handleStartOver}
              accessibilityRole="button"
              accessibilityLabel={`Start ${book.title} from the beginning`}
            >
              <MaterialIcons name="replay" size={20} color={theme.text} />
              <ThemedText style={styles.secondaryButtonText}>Start Over</ThemedText>
            </Pressable>
          )}
        </Animated.View>

        {/* Tabs: Chapters / Bookmarks */}
        <Animated.View entering={FadeInDown.delay(300).duration(400)}>
          <View style={styles.tabBar}>
            <Pressable
              style={[styles.tab, activeTab === 'chapters' && { borderBottomColor: theme.accent }]}
              onPress={() => setActiveTab('chapters')}
              accessibilityRole="tab"
              accessibilityLabel={`Chapters, ${chapters.length} total`}
              accessibilityState={{ selected: activeTab === 'chapters' }}
            >
              <ThemedText
                style={[
                  styles.tabText,
                  { color: activeTab === 'chapters' ? theme.accent : theme.textSecondary },
                ]}
              >
                Chapters ({chapters.length})
              </ThemedText>
            </Pressable>
            <Pressable
              style={[styles.tab, activeTab === 'bookmarks' && { borderBottomColor: theme.accent }]}
              onPress={() => setActiveTab('bookmarks')}
              accessibilityRole="tab"
              accessibilityLabel={`Bookmarks, ${bookmarks.length} saved`}
              accessibilityState={{ selected: activeTab === 'bookmarks' }}
            >
              <ThemedText
                style={[
                  styles.tabText,
                  { color: activeTab === 'bookmarks' ? theme.accent : theme.textSecondary },
                ]}
              >
                Bookmarks ({bookmarks.length})
              </ThemedText>
            </Pressable>
          </View>

          {/* Chapters List */}
          {activeTab === 'chapters' && (
            <View style={styles.listContainer}>
              {chapters.map((chapter, index) => {
                const chProgress = getChapterProgress(chapter);
                const isActive = isChapterActive(chapter);
                const isComplete = chProgress >= 1;

                return (
                  <Pressable
                    key={chapter.id}
                    style={({ pressed }) => [
                      styles.chapterRow,
                      {
                        backgroundColor: isActive
                          ? theme.backgroundElement
                          : pressed
                          ? theme.backgroundElement + '88'
                          : 'transparent',
                      },
                    ]}
                    onPress={() => handlePlay(chapter)}
                    accessibilityRole="button"
                    accessibilityLabel={`${chapter.title}, ${formatDuration(chapter.duration)}${isActive ? ', currently playing' : isComplete ? ', completed' : ''}`}
                    accessibilityState={{ selected: isActive }}
                  >
                    {/* Chapter Number / Status */}
                    <View style={styles.chapterIndex}>
                      {isComplete ? (
                        <MaterialIcons name="check-circle" size={20} color={theme.accent} />
                      ) : isActive ? (
                        <MaterialIcons name="play-arrow" size={18} color={theme.accent} />
                      ) : (
                        <ThemedText themeColor="textSecondary" style={styles.chapterNumber}>
                          {index + 1}
                        </ThemedText>
                      )}
                    </View>

                    {/* Chapter Info */}
                    <View style={styles.chapterInfo}>
                      <ThemedText
                        numberOfLines={1}
                        style={[
                          styles.chapterTitle,
                          isActive && { color: theme.accent },
                        ]}
                      >
                        {chapter.title}
                      </ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">
                        {formatTimestamp(chapter.startTime)} · {formatDuration(chapter.duration)}
                      </ThemedText>

                      {/* Per-chapter progress bar */}
                      {chProgress > 0 && chProgress < 1 && (
                        <View style={[styles.chapterProgressBg, { backgroundColor: theme.backgroundSelected }]}>
                          <View
                            style={[
                              styles.chapterProgressFill,
                              { backgroundColor: theme.accent, width: `${chProgress * 100}%` },
                            ]}
                          />
                        </View>
                      )}
                    </View>

                    <MaterialIcons name="chevron-right" size={18} color={theme.textSecondary} />
                  </Pressable>
                );
              })}
            </View>
          )}

          {/* Bookmarks List */}
          {activeTab === 'bookmarks' && (
            <View style={styles.listContainer}>
              {bookmarks.length === 0 ? (
                <View style={styles.emptyList}>
                  <MaterialIcons name="bookmark" size={36} color={theme.backgroundSelected} />
                  <ThemedText themeColor="textSecondary" style={styles.emptyText}>
                    No bookmarks yet.{'\n'}Add them while listening.
                  </ThemedText>
                </View>
              ) : (
                bookmarks.map((bm) => {
                  const ch = chapters.find((c) => c.id === bm.chapterId);
                  return (
                    <Pressable
                      key={bm.id}
                      style={({ pressed }) => [
                        styles.bookmarkRow,
                        { backgroundColor: pressed ? theme.backgroundElement + '88' : 'transparent' },
                      ]}
                      onPress={() => {
                        if (!book) return;
                        setCurrentBook(book);
                        setStoreChapters(chapters);
                        if (ch) setCurrentChapter(ch);
                        setPosition(bm.position);
                        router.push('/player');
                      }}
                    >
                      <MaterialIcons name="bookmark" size={18} color={theme.accent} />
                      <View style={styles.bookmarkInfo}>
                        <ThemedText numberOfLines={1} style={styles.bookmarkNote}>
                          {bm.note || `Bookmark at ${formatTimestamp(bm.position)}`}
                        </ThemedText>
                        <ThemedText type="small" themeColor="textSecondary">
                          {ch ? ch.title : 'Unknown'} · {formatTimestamp(bm.position)}
                        </ThemedText>
                      </View>
                    </Pressable>
                  );
                })
              )}
            </View>
          )}
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: Spacing.six,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
  },
  errorBackBtn: {
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.three,
    marginTop: Spacing.two,
  },

  // --- Hero ---
  heroSection: {
    alignItems: 'center',
    paddingBottom: Spacing.four,
  },
  backButtonSafeArea: {
    position: 'absolute',
    top: 0,
    left: 0,
    zIndex: 10,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: Spacing.three,
    marginTop: Spacing.two,
  },
  coverContainer: {
    marginTop: Spacing.six,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 12,
  },
  coverImage: {
    width: COVER_SIZE,
    height: COVER_SIZE,
    borderRadius: Spacing.four,
  },
  coverPlaceholder: {
    width: COVER_SIZE,
    height: COVER_SIZE,
    borderRadius: Spacing.four,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // --- Metadata ---
  metaSection: {
    paddingHorizontal: Spacing.four,
    alignItems: 'center',
    marginTop: Spacing.two,
  },
  bookTitle: {
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 28,
    letterSpacing: -0.3,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  metaText: {
    fontSize: 15,
    fontWeight: '500',
  },
  genreContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginTop: Spacing.two,
  },
  genreBulletItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  genreBulletText: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  metaChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: Spacing.two,
    marginTop: Spacing.three,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: Spacing.three,
    paddingVertical: 6,
    borderRadius: 100,
  },
  overallProgress: {
    width: '100%',
    marginTop: Spacing.four,
    paddingTop: Spacing.three,
    borderTopWidth: 1,
    borderTopColor: 'rgba(128,128,128,0.12)',
  },
  progressLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  progressBarBg: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },

  // --- Actions ---
  actionsSection: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.four,
    gap: Spacing.three,
    marginTop: Spacing.four,
    marginBottom: Spacing.four,
  },
  primaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingVertical: 14,
    borderRadius: Spacing.three,
  },
  primaryButtonText: {
    color: '#000',
    fontWeight: '700',
    fontSize: 16,
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingVertical: 14,
    paddingHorizontal: Spacing.four,
    borderRadius: Spacing.three,
  },
  secondaryButtonText: {
    fontWeight: '600',
    fontSize: 15,
  },

  // --- Tabs ---
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(128,128,128,0.15)',
    marginHorizontal: Spacing.four,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.three,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabText: {
    fontWeight: '600',
    fontSize: 14,
  },

  // --- Chapter List ---
  listContainer: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
  },
  chapterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.two,
    borderRadius: Spacing.two,
    gap: Spacing.three,
  },
  chapterIndex: {
    width: 28,
    alignItems: 'center',
  },
  chapterNumber: {
    fontSize: 14,
    fontWeight: '600',
  },
  chapterInfo: {
    flex: 1,
  },
  chapterTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  chapterProgressBg: {
    height: 2,
    borderRadius: 1,
    marginTop: 6,
    overflow: 'hidden',
  },
  chapterProgressFill: {
    height: '100%',
  },

  // --- Bookmarks ---
  bookmarkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.two,
    borderRadius: Spacing.two,
    gap: Spacing.three,
  },
  bookmarkInfo: {
    flex: 1,
  },
  bookmarkNote: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  emptyList: {
    alignItems: 'center',
    paddingVertical: Spacing.six,
    gap: Spacing.two,
  },
  emptyText: {
    textAlign: 'center',
    lineHeight: 20,
  },
});
