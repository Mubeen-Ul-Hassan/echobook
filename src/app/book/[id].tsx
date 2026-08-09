import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Pressable,
  ScrollView,
  Dimensions,
  View,
} from 'react-native';
import { preload } from 'expo-audio';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSQLiteContext } from 'expo-sqlite';
import { Image } from 'expo-image';
import { MaterialIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter, usePathname, useFocusEffect } from 'expo-router';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { dbService } from '@/database/services';
import { importService } from '@/features/import/services/import-service';
import { AudiobookRecord, ChapterRecord, PlaybackRecord, BookmarkRecord } from '@/database/types';
import { Spacing } from '@/constants/theme';
import { usePlaybackStore } from '@/hooks/use-playback-store';
import { EditMetadataModal } from '@/features/library/components/EditMetadataModal';
import { navigateToPlayer, safeGoBack } from '@/utils/navigation';

const { width } = Dimensions.get('window');
const COVER_SIZE = width * 0.55;

export default function BookDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useSQLiteContext();
  const theme = useTheme();
  const router = useRouter();
  const pathname = usePathname();

  const storeBook = usePlaybackStore((s) => s.currentBook);
  const storePosition = usePlaybackStore((s) => s.position);

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
  const [showEditModal, setShowEditModal] = useState(false);

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

      if (bookData) {
        importService
          .repairOrRefreshBookMetadata(db, id)
          .then(({ audiobook, chapters: refreshedChapters }) => {
            if (audiobook) setBook(audiobook);
            if (refreshedChapters.length > 0) setChapters(refreshedChapters);
          })
          .catch(console.warn);
      }

      if (bookData?.audioPath) {
        preload({ uri: bookData.audioPath }).catch(() => {});
      }

      if (!bookData) {
        setLoadError('Book not found. It may have been removed.');
      }
    } catch (error) {
      console.error('Failed to load book data:', error);
      setLoadError('Failed to load book details. Please try again.');
    }
  }, [db, id]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const currentPosition =
    storeBook?.id === id ? storePosition : (playback?.position ?? 0);

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
    if (!book || book.duration === 0) return 0;
    return Math.min(1, currentPosition / book.duration);
  };

  const isCompleted = playback?.completed === 1 || getProgress() >= 0.99;

  const handleToggleCompleted = async () => {
    if (!book) return;
    await dbService.setBookCompleted(db, book.id, !isCompleted);
    await loadData();
  };

  const handleSaveMetadata = async (fields: any) => {
    if (!book) return;
    await dbService.updateAudiobookMetadata(db, book.id, fields);
    await loadData();
  };

  const handlePlay = (chapter?: ChapterRecord) => {
    if (!book) return;
    usePlaybackStore.getState().setIsPlayerVisible(true);
    setCurrentBook(book);
    setStoreChapters(chapters);

    if (chapter) {
      setCurrentChapter(chapter);
      setPosition(chapter.startTime);
    } else if (currentPosition > 0) {
      const activeChapter = chapters.find(ch => currentPosition >= ch.startTime && currentPosition < ch.endTime) || chapters[0] || null;
      setCurrentChapter(activeChapter);
      setPosition(currentPosition);
      if (playback?.speed) setSpeed(playback.speed);
    } else {
      setCurrentChapter(chapters[0] || null);
      setPosition(0);
    }

    navigateToPlayer(router, pathname);
  };

  const handleStartOver = () => {
    if (!book) return;
    usePlaybackStore.getState().setIsPlayerVisible(true);
    setCurrentBook(book);
    setStoreChapters(chapters);
    setCurrentChapter(chapters[0] || null);
    setPosition(0);
    navigateToPlayer(router, pathname);
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
                onPress={() => safeGoBack(router)}
                style={[styles.errorBackBtn, { backgroundColor: theme.backgroundElement }]}
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
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Cover Art Hero */}
        <Animated.View entering={FadeIn.duration(400)} style={styles.heroSection}>
          <SafeAreaView edges={['top']} style={styles.headerSafeArea}>
            <Pressable
              onPress={() => safeGoBack(router)}
              style={({ pressed }) => [
                styles.iconBtn,
                { backgroundColor: pressed ? theme.backgroundSelected : theme.backgroundElement + 'CC' },
              ]}
              hitSlop={12}
            >
              <MaterialIcons name="arrow-back" size={20} color={theme.text} />
            </Pressable>

            <Pressable
              onPress={() => setShowEditModal(true)}
              style={({ pressed }) => [
                styles.iconBtn,
                { backgroundColor: pressed ? theme.backgroundSelected : theme.backgroundElement + 'CC' },
              ]}
              hitSlop={12}
            >
              <MaterialIcons name="edit" size={18} color={theme.text} />
            </Pressable>
          </SafeAreaView>

          <View style={styles.coverContainer}>
            {book.coverPath ? (
              <Image source={{ uri: book.coverPath }} style={styles.coverImage} contentFit="cover" />
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

          {book.narrator && (
            <View style={styles.metaRow}>
              <MaterialIcons name="mic" size={16} color={theme.textSecondary} />
              <ThemedText themeColor="textSecondary" style={styles.metaText}>
                Narrated by {book.narrator}
              </ThemedText>
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
          </View>

          {/* Progress */}
          {currentPosition > 0 && (
            <View style={styles.overallProgress}>
              <View style={styles.progressLabelRow}>
                <ThemedText type="small" themeColor="textSecondary">
                  {Math.round(progress * 100)}% complete
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {formatDuration(book.duration - currentPosition)} left
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

        {/* Actions */}
        <Animated.View entering={FadeInDown.delay(200).duration(400)} style={styles.actionsSection}>
          <Pressable
            style={({ pressed }) => [
              styles.primaryButton,
              { backgroundColor: pressed ? '#E06E00' : theme.accent },
            ]}
            onPress={() => handlePlay()}
          >
            <MaterialIcons name="play-arrow" size={22} color="#000" />
            <ThemedText style={styles.primaryButtonText}>
              {currentPosition > 0 ? 'Resume' : 'Play'}
            </ThemedText>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.secondaryButton,
              { backgroundColor: pressed ? theme.backgroundSelected : theme.backgroundElement },
            ]}
            onPress={handleToggleCompleted}
          >
            <MaterialIcons
              name={isCompleted ? 'check-circle' : 'check-circle-outline'}
              size={20}
              color={isCompleted ? '#30D158' : theme.text}
            />
            <ThemedText style={[styles.secondaryButtonText, isCompleted && { color: '#30D158' }]}>
              {isCompleted ? 'Completed' : 'Mark Done'}
            </ThemedText>
          </Pressable>
        </Animated.View>

        {/* Tabs */}
        <Animated.View entering={FadeInDown.delay(300).duration(400)}>
          <View style={styles.tabBar}>
            <Pressable
              style={[styles.tab, activeTab === 'chapters' && { borderBottomColor: theme.accent }]}
              onPress={() => setActiveTab('chapters')}
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

          {activeTab === 'chapters' && (
            <View style={styles.listContainer}>
              {chapters.map((chapter, index) => (
                <Pressable
                  key={chapter.id}
                  style={styles.chapterRow}
                  onPress={() => handlePlay(chapter)}
                >
                  <ThemedText themeColor="textSecondary" style={styles.chapterNumber}>
                    {index + 1}
                  </ThemedText>
                  <View style={styles.chapterInfo}>
                    <ThemedText style={styles.chapterTitle} numberOfLines={1}>
                      {chapter.title}
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {formatTimestamp(chapter.startTime)} · {formatDuration(chapter.duration)}
                    </ThemedText>
                  </View>
                </Pressable>
              ))}
            </View>
          )}
        </Animated.View>
      </ScrollView>

      {/* Edit Metadata Modal */}
      <EditMetadataModal
        visible={showEditModal}
        book={book}
        onSave={handleSaveMetadata}
        onClose={() => setShowEditModal(false)}
      />
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
  },
  errorBackBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
  },
  heroSection: {
    alignItems: 'center',
    paddingBottom: Spacing.four,
  },
  headerSafeArea: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    zIndex: 10,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  coverContainer: {
    marginTop: Spacing.six,
  },
  coverImage: {
    width: COVER_SIZE,
    height: COVER_SIZE,
    borderRadius: 20,
  },
  coverPlaceholder: {
    width: COVER_SIZE,
    height: COVER_SIZE,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metaSection: {
    paddingHorizontal: Spacing.four,
    alignItems: 'center',
    marginTop: Spacing.two,
  },
  bookTitle: {
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  metaText: {
    fontSize: 14,
  },
  metaChips: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  overallProgress: {
    width: '100%',
    marginTop: 16,
  },
  progressLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  progressBarBg: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
  },
  actionsSection: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.four,
    gap: 12,
    marginVertical: 20,
  },
  primaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 16,
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
    gap: 6,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 16,
  },
  secondaryButtonText: {
    fontWeight: '600',
    fontSize: 14,
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(128,128,128,0.15)',
    marginHorizontal: Spacing.four,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabText: {
    fontWeight: '600',
    fontSize: 14,
  },
  listContainer: {
    paddingHorizontal: Spacing.four,
    paddingTop: 12,
  },
  chapterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
  },
  chapterNumber: {
    fontSize: 14,
    fontWeight: '600',
    width: 24,
  },
  chapterInfo: {
    flex: 1,
  },
  chapterTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
});
