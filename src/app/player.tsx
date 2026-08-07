import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  ActivityIndicator,
  AccessibilityInfo,
  TextInput,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { useSQLiteContext } from 'expo-sqlite';
import { MaterialIcons } from '@expo/vector-icons';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeOut,
  SlideInDown,
  SlideOutDown,
  ZoomIn,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { usePlaybackStore } from '@/hooks/use-playback-store';
import { usePlayerContext } from '@/features/player/components/playback-provider';
import { dbService } from '@/database/services';
import { Spacing } from '@/constants/theme';
import { BookmarkRecord } from '@/database/types';
import { getAudioPlayer } from '@/features/player/services/audio-service';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const COVER_SIZE = SCREEN_WIDTH * 0.72;
const SEEK_BAR_WIDTH = SCREEN_WIDTH - Spacing.four * 2;

const SPEED_OPTIONS = [0.75, 1.0, 1.25, 1.5, 1.75, 2.0];

const SLEEP_OPTIONS: { label: string; value: number | 'chapter' }[] = [
  { label: '10m', value: 600 },
  { label: '15m', value: 900 },
  { label: '20m', value: 1200 },
  { label: '30m', value: 1800 },
  { label: '45m', value: 2700 },
  { label: '60m', value: 3600 },
  { label: 'End of chapter', value: 'chapter' },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  if (h > 0) return `${h}:${pad(m)}:${pad(sec)}`;
  return `${m}:${pad(sec)}`;
}

function formatRemaining(remaining: number, totalDuration: number = 0): string {
  if (totalDuration <= 0) return '-:--';
  return `-${formatTime(remaining)}`;
}

function formatRemainingText(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m left`;
  if (m > 0) return `${m}m ${sec}s left`;
  return `${sec}s left`;
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function SkipBackIcon({ size = 36, color = '#FFF' }: { size?: number; color?: string; seconds?: number }) {
  return <MaterialIcons name="replay-30" size={size} color={color} />;
}

function SkipForwardIcon({ size = 36, color = '#FFF' }: { size?: number; color?: string; seconds?: number }) {
  return <MaterialIcons name="forward-30" size={size} color={color} />;
}

// ---------------------------------------------------------------------------
// AnimatedPressable – play button with spring press feedback
// ---------------------------------------------------------------------------

interface AnimatedPressableProps {
  onPress: () => void;
  style?: object;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  children: React.ReactNode;
}

function AnimatedPressable({
  onPress,
  style,
  accessibilityLabel,
  accessibilityHint,
  children,
}: AnimatedPressableProps) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Pressable
      onPressIn={() => { scale.value = withSpring(0.88, { damping: 10, stiffness: 200 }); }}
      onPressOut={() => { scale.value = withSpring(1, { damping: 10, stiffness: 200 }); }}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
    >
      <Animated.View style={[style, animStyle]}>{children}</Animated.View>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Smooth Seek Bar using Reanimated interpolation
// ---------------------------------------------------------------------------

interface SeekBarProps {
  position: number;
  duration: number;
  chapterStart: number;
  chapterEnd: number;
  mode: 'chapter' | 'book';
  onSeek: (seconds: number) => void;
  accentColor: string;
  trackColor: string;
}

function SeekBar({
  position,
  duration,
  chapterStart,
  chapterEnd,
  mode,
  onSeek,
  accentColor,
  trackColor,
}: SeekBarProps) {
  const isDraggingRef = useRef(false);
  const justSoughtRef = useRef(false);
  const lockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isChapterMode = mode === 'chapter';
  const effectiveStart = isChapterMode ? chapterStart : 0;
  const effectiveEnd = isChapterMode ? chapterEnd : duration;
  const effectiveDuration = Math.max(1, effectiveEnd - effectiveStart);
  const currentOffset = Math.max(0, Math.min(effectiveDuration, position - effectiveStart));
  const currentRatio = currentOffset / effectiveDuration;

  // Reanimated shared values – all gesture handling below runs entirely on the
  // UI thread (via react-native-gesture-handler worklets), which avoids the
  // JS-thread round trips / stale `locationX` readings that make a PanResponder
  // based slider feel like it "jumps"/"blinks" while dragging on Android.
  const progressSV = useSharedValue(currentRatio);
  const isDragging = useSharedValue(false);

  useEffect(() => {
    if (!isDraggingRef.current && !justSoughtRef.current && effectiveDuration > 0) {
      progressSV.value = withTiming(Math.min(1, Math.max(0, currentRatio)), {
        duration: 240,
        easing: Easing.linear,
      });
    }
  }, [currentRatio, effectiveDuration, progressSV]);

  const fillStyle = useAnimatedStyle(() => ({
    width: progressSV.value * SEEK_BAR_WIDTH,
  }));

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: progressSV.value * SEEK_BAR_WIDTH - 8 },
      { scale: withTiming(isDragging.value ? 1.35 : 1, { duration: 120 }) },
    ],
  }));

  const chapterStartPx = duration > 0 ? (chapterStart / duration) * SEEK_BAR_WIDTH : 0;
  const chapterWidthPx =
    duration > 0
      ? ((chapterEnd - chapterStart) / duration) * SEEK_BAR_WIDTH
      : SEEK_BAR_WIDTH;

  const handleDragStart = useCallback(() => {
    isDraggingRef.current = true;
    if (lockTimerRef.current) clearTimeout(lockTimerRef.current);
  }, []);

  const handleDragEnd = useCallback(
    (ratio: number) => {
      isDraggingRef.current = false;
      justSoughtRef.current = true;
      onSeek(effectiveStart + ratio * effectiveDuration);

      if (lockTimerRef.current) clearTimeout(lockTimerRef.current);
      lockTimerRef.current = setTimeout(() => {
        justSoughtRef.current = false;
      }, 500);
    },
    [onSeek, effectiveStart, effectiveDuration],
  );

  const panGesture = Gesture.Pan()
    .minDistance(0)
    .onBegin((evt) => {
      'worklet';
      isDragging.value = true;
      progressSV.value = Math.min(1, Math.max(0, evt.x / SEEK_BAR_WIDTH));
      runOnJS(handleDragStart)();
    })
    .onUpdate((evt) => {
      'worklet';
      progressSV.value = Math.min(1, Math.max(0, evt.x / SEEK_BAR_WIDTH));
    })
    .onEnd((evt) => {
      'worklet';
      const ratio = Math.min(1, Math.max(0, evt.x / SEEK_BAR_WIDTH));
      progressSV.value = ratio;
      isDragging.value = false;
      runOnJS(handleDragEnd)(ratio);
    })
    .onFinalize(() => {
      'worklet';
      isDragging.value = false;
    });

  return (
    <GestureDetector gesture={panGesture}>
      <View
        style={styles.seekBarHitArea}
        accessibilityRole="adjustable"
        accessibilityLabel={`Progress: ${formatTime(currentOffset)} of ${formatTime(effectiveDuration)}`}
        accessibilityValue={{ min: 0, max: effectiveDuration, now: Math.floor(currentOffset) }}
        accessibilityActions={[
          { name: 'increment', label: 'Skip forward 30 seconds' },
          { name: 'decrement', label: 'Skip back 30 seconds' },
        ]}
      >
        {/* Track background */}
        <View style={[styles.seekTrack, { backgroundColor: trackColor }]}>
          {!isChapterMode && (
            /* Chapter range highlight when in Book mode */
            <View
              style={[
                styles.seekChapterRange,
                { left: chapterStartPx, width: chapterWidthPx, backgroundColor: accentColor + '28' },
              ]}
            />
          )}
          {/* Progress fill – driven by Reanimated shared value */}
          <Animated.View style={[styles.seekFill, { backgroundColor: accentColor }, fillStyle]} />
        </View>
        {/* Thumb dot */}
        <Animated.View
          style={[
            styles.seekThumb,
            {
              backgroundColor: accentColor,
              shadowColor: accentColor,
              shadowOpacity: 0.5,
              shadowRadius: 4,
              elevation: 3,
            },
            thumbStyle,
          ]}
        />
      </View>
    </GestureDetector>
  );
}

// ---------------------------------------------------------------------------
// Autoplay Countdown Overlay
// ---------------------------------------------------------------------------

function AutoplayCountdown({ onSkip, onCancel }: { onSkip: () => void; onCancel: () => void }) {
  const theme = useTheme();
  const autoplayCountdownRemaining = usePlaybackStore((s) => s.autoplayCountdownRemaining);
  const tickAutoplayCountdown = usePlaybackStore((s) => s.tickAutoplayCountdown);
  const cancelAutoplayCountdown = usePlaybackStore((s) => s.cancelAutoplayCountdown);

  useEffect(() => {
    const id = setInterval(() => tickAutoplayCountdown(), 1000);
    return () => clearInterval(id);
  }, [tickAutoplayCountdown]);

  useEffect(() => {
    if (autoplayCountdownRemaining === 0) onSkip();
  }, [autoplayCountdownRemaining, onSkip]);

  // Announce chapter transition to screen readers
  useEffect(() => {
    AccessibilityInfo.announceForAccessibility('Next chapter starting in 5 seconds');
  }, []);

  return (
    <Animated.View
      entering={FadeIn.duration(250)}
      exiting={FadeOut.duration(200)}
      style={[styles.countdownOverlay, { backgroundColor: theme.background + 'EE' }]}
    >
      <Animated.View
        entering={FadeInDown.duration(280).easing(Easing.out(Easing.cubic))}
        style={[styles.countdownCard, { backgroundColor: theme.backgroundElement }]}
      >
        <ThemedText themeColor="textSecondary" style={styles.countdownLabel}>
          NEXT CHAPTER
        </ThemedText>
        <ThemedText
          style={styles.countdownNumber}
          accessibilityLabel={`${autoplayCountdownRemaining} seconds until next chapter`}
          accessibilityLiveRegion="polite"
        >
          {autoplayCountdownRemaining}
        </ThemedText>
        <View style={styles.countdownButtons}>
          <Pressable
            onPress={() => { cancelAutoplayCountdown(); onCancel(); }}
            style={[styles.countdownBtn, { backgroundColor: theme.backgroundSelected }]}
            accessibilityRole="button"
            accessibilityLabel="Cancel autoplay"
          >
            <MaterialIcons name="close" size={16} color={theme.text} />
            <ThemedText style={styles.countdownBtnText}>Cancel</ThemedText>
          </Pressable>
          <Pressable
            onPress={onSkip}
            style={[styles.countdownBtn, { backgroundColor: theme.accent }]}
            accessibilityRole="button"
            accessibilityLabel="Skip to next chapter now"
          >
            <MaterialIcons name="skip-next" size={18} color="#000" />
            <ThemedText style={[styles.countdownBtnText, { color: '#000' }]}>Skip Now</ThemedText>
          </Pressable>
        </View>
      </Animated.View>
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Main Player Screen
// ---------------------------------------------------------------------------

export default function PlayerScreen() {
  const router = useRouter();
  const theme = useTheme();
  const db = useSQLiteContext();
  const player = getAudioPlayer();
  const insets = useSafeAreaInsets();
  const bottomSafePadding = Math.max(insets.bottom, 16);
  const {
    play,
    pause,
    togglePlayPause,
    seekTo,
    skipForward,
    skipBackward,
    nextChapter,
    prevChapter,
    jumpToChapter,
    setSpeed,
    startBook,
  } = usePlayerContext();

  const currentBook = usePlaybackStore((s) => s.currentBook);
  const currentChapter = usePlaybackStore((s) => s.currentChapter);
  const chapters = usePlaybackStore((s) => s.chapters);
  const isPlaying = usePlaybackStore((s) => s.isPlaying);
  const isLoaded = usePlaybackStore((s) => s.isLoaded);
  const position = usePlaybackStore((s) => s.position);
  const speed = usePlaybackStore((s) => s.speed);
  const isAutoplayCountdown = usePlaybackStore((s) => s.isAutoplayCountdown);
  const cancelAutoplayCountdown = usePlaybackStore((s) => s.cancelAutoplayCountdown);
  const sleepTimerRemaining = usePlaybackStore((s) => s.sleepTimerRemaining);
  const sleepTimerType = usePlaybackStore((s) => s.sleepTimerType);
  const startSleepTimer = usePlaybackStore((s) => s.startSleepTimer);
  const clearSleepTimer = usePlaybackStore((s) => s.clearSleepTimer);
  const playbackError = usePlaybackStore((s) => s.playbackError);
  const setPlaybackError = usePlaybackStore((s) => s.setPlaybackError);
  const setIsPlayerVisible = usePlaybackStore((s) => s.setIsPlayerVisible);

  const [showSpeedSheet, setShowSpeedSheet] = useState(false);
  const [showSleepSheet, setShowSleepSheet] = useState(false);
  const [showBookmarkSheet, setShowBookmarkSheet] = useState(false);
  const [showChapterSheet, setShowChapterSheet] = useState(false);
  const [bookmarkNote, setBookmarkNote] = useState('');
  const [bookmarks, setBookmarks] = useState<BookmarkRecord[]>([]);
  const [timeDisplayMode, setTimeDisplayMode] = useState<'chapter' | 'book'>('chapter');

  // Notify store that player screen is open (hides mini-player)
  useEffect(() => {
    setIsPlayerVisible(true);
    return () => setIsPlayerVisible(false);
  }, [setIsPlayerVisible]);

  // Start audio on mount if not already playing the correct book
  useEffect(() => {
    if (!currentBook || !chapters.length) return;
    if (!player.isLoaded || !player.playing) {
      startBook(currentBook, chapters, position, true).catch(console.warn);
    }
  }, []); // Intentionally run only on mount

  // Load bookmarks whenever the sheet opens
  useEffect(() => {
    if (!currentBook) return;
    dbService
      .getBookmarksByBookId(db, currentBook.id)
      .then(setBookmarks)
      .catch(console.warn);
  }, [db, currentBook, showBookmarkSheet]);

  // Announce current chapter to screen readers when it changes
  useEffect(() => {
    if (currentChapter) {
      AccessibilityInfo.announceForAccessibility(`Now playing: ${currentChapter.title}`);
    }
  }, [currentChapter?.id]);

  // ---------------------------------------------------------------------------
  // Computed values
  // ---------------------------------------------------------------------------

  const storeDuration = usePlaybackStore((s) => s.duration);
  const bookDuration = (currentBook?.duration && currentBook.duration > 0)
    ? currentBook.duration
    : storeDuration;

  const chapterStart = currentChapter?.startTime ?? 0;
  const chapterEnd = currentChapter?.endTime ?? bookDuration;
  const currentChapterIndex = chapters.findIndex((ch) => ch.id === currentChapter?.id);
  const hasNextChapter = currentChapterIndex < chapters.length - 1;
  const hasPrevChapter = currentChapterIndex > 0;

  const rawChapterTitle = currentChapter?.title ?? (chapters.length > 0 ? chapters[0].title : currentBook?.title ?? '');
  const chapterDisplayTitle = currentChapterIndex >= 0
    ? (rawChapterTitle.toLowerCase().startsWith('chapter') ? rawChapterTitle : `Chapter ${currentChapterIndex + 1} - ${rawChapterTitle}`)
    : rawChapterTitle;

  const chapterElapsed = Math.max(0, position - chapterStart);
  const chapterDuration = Math.max(0, chapterEnd - chapterStart);
  const chapterRemaining = Math.max(0, chapterEnd - position);
  const totalRemaining = Math.max(0, bookDuration - position);

  const displayElapsed = timeDisplayMode === 'chapter' ? chapterElapsed : position;
  const displayRemaining = timeDisplayMode === 'chapter' ? chapterRemaining : totalRemaining;
  const displayTotalDuration = timeDisplayMode === 'chapter' ? chapterDuration : bookDuration;

  const chapterProgress =
    chapterEnd > chapterStart
      ? Math.min(1, Math.max(0, (position - chapterStart) / (chapterEnd - chapterStart)))
      : 0;

  const sleepTimerLabel = (() => {
    if (!sleepTimerType) return null;
    if (sleepTimerType === 'chapter') return 'Chapter end';
    if (sleepTimerRemaining != null) return formatDuration(sleepTimerRemaining);
    return null;
  })();

  // ---------------------------------------------------------------------------
  // Event handlers
  // ---------------------------------------------------------------------------

  const handleAutoplaySkip = useCallback(async () => {
    cancelAutoplayCountdown();
    await nextChapter();
  }, [cancelAutoplayCountdown, nextChapter]);

  const handleAutoplayCancel = useCallback(() => {
    cancelAutoplayCountdown();
  }, [cancelAutoplayCountdown]);

  const handleAddBookmark = useCallback(async () => {
    if (!currentBook) return;
    try {
      const id = Date.now().toString(36) + Math.random().toString(36).slice(2);
      await dbService.insertBookmark(db, {
        id,
        bookId: currentBook.id,
        chapterId: currentChapter?.id ?? null,
        position: player.currentTime,
        note: bookmarkNote.trim() || null,
        createdAt: new Date().toISOString(),
      });
      setBookmarkNote('');
      setShowBookmarkSheet(false);
      const updated = await dbService.getBookmarksByBookId(db, currentBook.id);
      setBookmarks(updated);
      AccessibilityInfo.announceForAccessibility('Bookmark saved');
    } catch (err) {
      console.warn('[Player] Failed to add bookmark:', err);
    }
  }, [db, currentBook, currentChapter, player, bookmarkNote]);

  const closeAllSheets = useCallback(() => {
    setShowSpeedSheet(false);
    setShowSleepSheet(false);
    setShowBookmarkSheet(false);
    setShowChapterSheet(false);
  }, []);

  const handleDismissError = useCallback(() => {
    setPlaybackError(null);
  }, [setPlaybackError]);

  // ---------------------------------------------------------------------------
  // No book state
  // ---------------------------------------------------------------------------

  if (!currentBook) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.noBookContainer}>
          <MaterialIcons name="graphic-eq" size={48} color={theme.textSecondary} />
          <ThemedText themeColor="textSecondary" style={styles.noBookText}>
            No audiobook selected.
          </ThemedText>
          <Pressable
            onPress={() => router.back()}
            style={[styles.backBtn, { backgroundColor: theme.backgroundElement }]}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <ThemedText>Go Back</ThemedText>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // ---------------------------------------------------------------------------
  // Main render
  // ---------------------------------------------------------------------------

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* ── Header ── */}
        <Animated.View entering={FadeInDown.duration(300)} style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            style={({ pressed }) => [
              styles.headerBtn,
              { backgroundColor: pressed ? theme.backgroundElement : 'transparent' },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Minimise player"
          >
            <MaterialIcons name="keyboard-arrow-down" size={32} color={theme.text} />
          </Pressable>

          <View style={styles.headerCenter}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.headerLabel}>
              NOW PLAYING
            </ThemedText>
          </View>

          {sleepTimerLabel ? (
            <Pressable
              onPress={() => setShowSleepSheet(true)}
              style={[styles.sleepBadge, { backgroundColor: theme.backgroundElement }]}
              accessibilityRole="button"
              accessibilityLabel={`Sleep timer: ${sleepTimerLabel}. Tap to modify.`}
            >
              <MaterialIcons name="timer" size={14} color={theme.accent} />
              <ThemedText style={[styles.sleepBadgeText, { color: theme.accent }]}>
                {sleepTimerLabel}
              </ThemedText>
            </Pressable>
          ) : (
            <View style={styles.headerBtn} />
          )}
        </Animated.View>

        {/* ── Error banner ── */}
        {playbackError && (
          <Animated.View
            entering={FadeIn.duration(200)}
            exiting={FadeOut.duration(200)}
            style={[styles.errorBanner, { backgroundColor: '#5C1A1A' }]}
          >
            <MaterialIcons name="error-outline" size={18} color="#FF6B6B" />
            <ThemedText style={styles.errorText} numberOfLines={2}>
              {playbackError}
            </ThemedText>
            <Pressable
              onPress={handleDismissError}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Dismiss error"
            >
              <MaterialIcons name="close" size={18} color="#FF6B6B" />
            </Pressable>
          </Animated.View>
        )}

        {/* ── Cover Art ── */}
        <Animated.View entering={FadeIn.duration(300)} style={styles.coverWrapper}>
          <View style={styles.coverContainer}>
            {currentBook.coverPath ? (
              <Image
                source={{ uri: currentBook.coverPath }}
                style={styles.coverImage}
                contentFit="cover"
                accessibilityLabel={`Cover art for ${currentBook.title}`}
              />
            ) : (
              <View style={[styles.coverPlaceholder, { backgroundColor: theme.backgroundElement }]}>
                <MaterialIcons name="graphic-eq" size={72} color={theme.textSecondary} />
              </View>
            )}

            {/* Loading spinner overlay */}
            {!isLoaded && (
              <View style={styles.loadingOverlay}>
                <ActivityIndicator size="large" color={theme.accent} />
              </View>
            )}
          </View>
        </Animated.View>

        {/* ── Book & Chapter Info ── */}
        <Animated.View entering={FadeInDown.delay(100).duration(300)} style={styles.infoSection}>
          <Pressable
            onPress={() => setShowChapterSheet(true)}
            style={({ pressed }) => [
              styles.chapterSelectorRow,
              { opacity: pressed ? 0.75 : 1 },
            ]}
            accessibilityRole="button"
            accessibilityLabel={`Current chapter: ${chapterDisplayTitle}. Tap to view and select chapters.`}
          >
            <MaterialIcons name="format-list-bulleted" size={22} color={theme.accent} style={{ marginRight: 8 }} />
            <ThemedText numberOfLines={2} style={styles.chapterTitle}>
              {chapterDisplayTitle}
            </ThemedText>
          </Pressable>

          <ThemedText numberOfLines={1} themeColor="textSecondary" style={styles.bookTitle}>
            {currentBook.title}
            {currentBook.author ? ` · ${currentBook.author}` : ''}
          </ThemedText>
        </Animated.View>

        {/* ── Seek Bar ── */}
        <Animated.View entering={FadeInDown.delay(150).duration(300)} style={styles.seekSection}>
          <SeekBar
            position={position}
            duration={bookDuration}
            chapterStart={chapterStart}
            chapterEnd={chapterEnd}
            mode={timeDisplayMode}
            onSeek={seekTo}
            accentColor={theme.accent}
            trackColor={theme.backgroundElement}
          />

          <View style={styles.timeRow}>
            <Pressable
              onPress={() => setTimeDisplayMode((m) => (m === 'chapter' ? 'book' : 'chapter'))}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={`Elapsed ${timeDisplayMode} time: ${formatTime(displayElapsed)}. Tap to toggle mode.`}
            >
              <ThemedText type="small" themeColor="textSecondary">
                {formatTime(displayElapsed)}
              </ThemedText>
            </Pressable>
            <Pressable
              onPress={() => setTimeDisplayMode((m) => (m === 'chapter' ? 'book' : 'chapter'))}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={`Remaining ${timeDisplayMode} time: ${formatRemainingText(displayRemaining)}. Tap to toggle mode.`}
            >
              <ThemedText type="small" themeColor="textSecondary">
                {formatRemainingText(displayRemaining)}
              </ThemedText>
            </Pressable>
          </View>
        </Animated.View>

        {/* ── Playback Controls ── */}
        <Animated.View entering={FadeInDown.delay(200).duration(300)} style={styles.controls}>
          {/* Previous chapter */}
          <Pressable
            onPress={prevChapter}
            disabled={!hasPrevChapter}
            hitSlop={12}
            style={({ pressed }) => [
              styles.controlBtn,
              { opacity: pressed || !hasPrevChapter ? 0.35 : 1 },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Previous chapter"
            accessibilityState={{ disabled: !hasPrevChapter }}
          >
            <MaterialIcons name="skip-previous" size={32} color={theme.text} />
          </Pressable>

          {/* Skip back 30 s */}
          <Pressable
            onPress={() => skipBackward(30)}
            hitSlop={12}
            style={({ pressed }) => [styles.controlBtn, { opacity: pressed ? 0.6 : 1 }]}
            accessibilityRole="button"
            accessibilityLabel="Skip back 30 seconds"
          >
            <SkipBackIcon size={38} color={theme.text} seconds={30} />
          </Pressable>

          {/* Play / Pause – animated ripple */}
          <AnimatedPressable
            onPress={togglePlayPause}
            style={[styles.playBtn, { backgroundColor: theme.accent }]}
            accessibilityLabel={isPlaying ? 'Pause' : 'Play'}
            accessibilityHint={
              isPlaying
                ? 'Double tap to pause playback'
                : 'Double tap to resume playback'
            }
          >
            {isPlaying ? (
              <MaterialIcons name="pause" size={36} color="#000" />
            ) : (
              <MaterialIcons name="play-arrow" size={36} color="#000" />
            )}
          </AnimatedPressable>

          {/* Skip forward 30 s */}
          <Pressable
            onPress={() => skipForward(30)}
            hitSlop={12}
            style={({ pressed }) => [styles.controlBtn, { opacity: pressed ? 0.6 : 1 }]}
            accessibilityRole="button"
            accessibilityLabel="Skip forward 30 seconds"
          >
            <SkipForwardIcon size={38} color={theme.text} seconds={30} />
          </Pressable>

          {/* Next chapter */}
          <Pressable
            onPress={nextChapter}
            disabled={!hasNextChapter}
            hitSlop={12}
            style={({ pressed }) => [
              styles.controlBtn,
              { opacity: pressed || !hasNextChapter ? 0.35 : 1 },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Next chapter"
            accessibilityState={{ disabled: !hasNextChapter }}
          >
            <MaterialIcons name="skip-next" size={32} color={theme.text} />
          </Pressable>
        </Animated.View>

        {/* ── Bottom toolbar: Speed | Bookmark | Sleep Timer ── */}
        <Animated.View
          entering={FadeInDown.delay(250).duration(300)}
          style={[styles.bottomRow, { paddingBottom: bottomSafePadding + Spacing.one }]}
        >
          <Pressable
            onPress={() => setShowSpeedSheet(true)}
            style={({ pressed }) => [
              styles.bottomChip,
              { backgroundColor: theme.backgroundElement, borderColor: theme.border, opacity: pressed ? 0.8 : 1 },
            ]}
            accessibilityRole="button"
            accessibilityLabel={`Playback speed: ${speed === 1.0 ? '1.0×' : `${speed}×`}. Tap to change.`}
          >
            <MaterialIcons name="speed" size={18} color={theme.accent} />
            <ThemedText style={[styles.bottomChipText, { color: theme.accent }]}>
              {speed === 1.0 ? '1.0×' : `${speed}×`}
            </ThemedText>
          </Pressable>

          <Pressable
            onPress={() => setShowBookmarkSheet(true)}
            style={({ pressed }) => [
              styles.bottomChip,
              { backgroundColor: theme.backgroundElement, borderColor: theme.border, opacity: pressed ? 0.8 : 1 },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Add bookmark"
          >
            <MaterialIcons name="bookmark-outline" size={18} color={theme.text} />
            <ThemedText style={styles.bottomChipText}>Mark</ThemedText>
          </Pressable>

          <Pressable
            onPress={() => setShowSleepSheet(true)}
            style={({ pressed }) => [
              styles.bottomChip,
              {
                backgroundColor: sleepTimerType ? theme.accent : theme.backgroundElement,
                borderColor: sleepTimerType ? theme.accent : theme.border,
                opacity: pressed ? 0.8 : 1,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel={
              sleepTimerLabel
                ? `Sleep timer active: ${sleepTimerLabel}. Tap to change.`
                : 'Set sleep timer'
            }
          >
            <MaterialIcons name="timer" size={18} color={sleepTimerType ? '#000' : theme.text} />
            <ThemedText style={[styles.bottomChipText, sleepTimerType ? { color: '#000' } : {}]}>
              {sleepTimerLabel ?? 'Sleep'}
            </ThemedText>
          </Pressable>
        </Animated.View>
      </ScrollView>

      {/* ── Autoplay Countdown overlay ── */}
      {isAutoplayCountdown && (
        <AutoplayCountdown onSkip={handleAutoplaySkip} onCancel={handleAutoplayCancel} />
      )}

      {/* ── Dark Backdrop Overlay for Sheets ── */}
      {(showSpeedSheet || showSleepSheet || showBookmarkSheet) && (
        <Pressable
          style={[StyleSheet.absoluteFill, { zIndex: 35 }]}
          onPress={() => {
            setShowSpeedSheet(false);
            setShowSleepSheet(false);
            setShowBookmarkSheet(false);
          }}
        >
          <Animated.View
            entering={FadeIn.duration(200)}
            exiting={FadeOut.duration(150)}
            style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0, 0, 0, 0.65)' }]}
          />
        </Pressable>
      )}

      {/* ── Speed Sheet ── */}
      {showSpeedSheet && (
        <Animated.View
          entering={SlideInDown.duration(280).easing(Easing.out(Easing.cubic))}
          exiting={SlideOutDown.duration(200).easing(Easing.in(Easing.cubic))}
          style={[
            styles.bottomSheet,
            {
              backgroundColor: theme.backgroundElement,
              borderColor: theme.border,
              paddingBottom: bottomSafePadding + Spacing.three,
            },
          ]}
        >
          <View style={[styles.sheetHandle, { backgroundColor: theme.backgroundSelected }]} />
          <View style={styles.sheetHeaderRow}>
            <MaterialIcons name="speed" size={22} color={theme.accent} />
            <ThemedText style={styles.sheetTitle}>Playback Speed</ThemedText>
          </View>
          <View style={styles.speedGrid}>
            {SPEED_OPTIONS.map((s) => (
              <Pressable
                key={s}
                onPress={() => { setSpeed(s); setShowSpeedSheet(false); }}
                style={({ pressed }) => [
                  styles.speedOption,
                  {
                    backgroundColor: speed === s ? theme.accent : theme.backgroundSelected,
                    borderColor: speed === s ? theme.accent : theme.border,
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
                accessibilityRole="button"
                accessibilityLabel={`${s === 1.0 ? '1.0×' : `${s}×`} speed`}
                accessibilityState={{ selected: speed === s }}
              >
                <ThemedText
                  style={[styles.speedOptionText, speed === s ? { color: '#000' } : {}]}
                >
                  {s === 1.0 ? '1.0×' : `${s}×`}
                </ThemedText>
              </Pressable>
            ))}
          </View>
          <Pressable
            onPress={() => setShowSpeedSheet(false)}
            style={[styles.sheetCloseBtn, { backgroundColor: theme.backgroundSelected }]}
            accessibilityRole="button"
            accessibilityLabel="Close speed sheet"
          >
            <ThemedText themeColor="textSecondary" style={{ fontWeight: '600' }}>Close</ThemedText>
          </Pressable>
        </Animated.View>
      )}

      {/* ── Sleep Timer Sheet ── */}
      {showSleepSheet && (
        <Animated.View
          entering={SlideInDown.duration(280).easing(Easing.out(Easing.cubic))}
          exiting={SlideOutDown.duration(200).easing(Easing.in(Easing.cubic))}
          style={[
            styles.bottomSheet,
            {
              backgroundColor: theme.backgroundElement,
              borderColor: theme.border,
              paddingBottom: bottomSafePadding + Spacing.three,
            },
          ]}
        >
          <View style={[styles.sheetHandle, { backgroundColor: theme.backgroundSelected }]} />
          <View style={styles.sheetHeaderRow}>
            <MaterialIcons name="timer" size={22} color={theme.accent} />
            <ThemedText style={styles.sheetTitle}>Sleep Timer</ThemedText>
          </View>

          {sleepTimerType && (
            <Pressable
              onPress={() => { clearSleepTimer(); setShowSleepSheet(false); }}
              style={[styles.clearTimerBtn, { backgroundColor: '#5C1A1A' }]}
              accessibilityRole="button"
              accessibilityLabel="Cancel sleep timer"
            >
              <MaterialIcons name="close" size={18} color="#FF6B6B" />
              <ThemedText style={[styles.clearTimerText, { color: '#FF6B6B' }]}>Cancel Timer</ThemedText>
            </Pressable>
          )}

          <View style={styles.sleepGrid}>
            {SLEEP_OPTIONS.map((opt) => {
              const isActive =
                (sleepTimerType === 'time' &&
                  typeof opt.value === 'number' &&
                  opt.value === usePlaybackStore.getState().sleepTimerDuration) ||
                (sleepTimerType === 'chapter' && opt.value === 'chapter');

              return (
                <Pressable
                  key={String(opt.value)}
                  onPress={() => {
                    if (typeof opt.value === 'number') {
                      startSleepTimer(opt.value, 'time');
                    } else {
                      startSleepTimer(0, 'chapter');
                    }
                    setShowSleepSheet(false);
                  }}
                  style={({ pressed }) => [
                    styles.sleepOption,
                    {
                      backgroundColor: isActive ? theme.accent : theme.backgroundSelected,
                      borderColor: isActive ? theme.accent : theme.border,
                      opacity: pressed ? 0.85 : 1,
                    },
                    opt.value === 'chapter' && { width: '100%', marginTop: 4 },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={`Sleep after ${opt.label}`}
                  accessibilityState={{ selected: isActive }}
                >
                  <ThemedText style={[styles.sleepOptionText, isActive ? { color: '#000' } : {}]}>
                    {opt.label}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>

          <Pressable
            onPress={() => setShowSleepSheet(false)}
            style={[styles.sheetCloseBtn, { backgroundColor: theme.backgroundSelected }]}
            accessibilityRole="button"
            accessibilityLabel="Close sleep timer sheet"
          >
            <ThemedText themeColor="textSecondary" style={{ fontWeight: '600' }}>Close</ThemedText>
          </Pressable>
        </Animated.View>
      )}

      {/* ── Bookmark Sheet ── */}
      {showBookmarkSheet && (
        <Animated.View
          entering={SlideInDown.duration(280).easing(Easing.out(Easing.cubic))}
          exiting={SlideOutDown.duration(200).easing(Easing.in(Easing.cubic))}
          style={[
            styles.bottomSheet,
            {
              backgroundColor: theme.backgroundElement,
              borderColor: theme.border,
              paddingBottom: bottomSafePadding + Spacing.three,
            },
          ]}
        >
          <View style={[styles.sheetHandle, { backgroundColor: theme.backgroundSelected }]} />
          <View style={styles.sheetHeaderRow}>
            <MaterialIcons name="bookmark" size={22} color={theme.accent} />
            <ThemedText style={styles.sheetTitle}>Add Bookmark</ThemedText>
          </View>
          <ThemedText themeColor="textSecondary" style={styles.bookmarkPosition}>
            {currentChapter?.title ?? ''} · {formatTime(position)}
          </ThemedText>

          <TextInput
            style={[
              styles.bookmarkInput,
              {
                color: theme.text,
                backgroundColor: theme.backgroundSelected,
                borderColor: theme.border,
              },
            ]}
            placeholder="Add an optional note..."
            placeholderTextColor={theme.textSecondary}
            value={bookmarkNote}
            onChangeText={setBookmarkNote}
            maxLength={100}
            keyboardAppearance="dark"
          />

          <Pressable
            onPress={handleAddBookmark}
            style={({ pressed }) => [
              styles.bookmarkAddBtn,
              { backgroundColor: theme.accent, opacity: pressed ? 0.85 : 1 },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Save bookmark at current position"
          >
            <MaterialIcons name="check" size={20} color="#000" />
            <ThemedText style={styles.bookmarkAddText}>Save Bookmark</ThemedText>
          </Pressable>

          {bookmarks.length > 0 && (
            <ScrollView style={styles.bookmarkList} showsVerticalScrollIndicator={false}>
              {bookmarks.slice(-5).reverse().map((bm) => {
                const bmChapter = chapters.find((c) => c.id === bm.chapterId);
                return (
                  <Pressable
                    key={bm.id}
                    onPress={() => { seekTo(bm.position); setShowBookmarkSheet(false); }}
                    style={({ pressed }) => [
                      styles.bookmarkItem,
                      { borderBottomColor: theme.border, opacity: pressed ? 0.7 : 1 },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={`Bookmark: ${bm.note ?? formatTime(bm.position)}, in ${bmChapter?.title ?? 'unknown chapter'}`}
                  >
                    <MaterialIcons name="bookmark" size={16} color={theme.accent} />
                    <View style={styles.bookmarkItemInfo}>
                      <ThemedText numberOfLines={1} style={styles.bookmarkItemNote}>
                        {bm.note ?? formatTime(bm.position)}
                      </ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">
                        {bmChapter?.title ?? ''} · {formatTime(bm.position)}
                      </ThemedText>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          )}

          <Pressable
            onPress={() => setShowBookmarkSheet(false)}
            style={[styles.sheetCloseBtn, { backgroundColor: theme.backgroundSelected }]}
            accessibilityRole="button"
            accessibilityLabel="Close bookmark sheet"
          >
            <ThemedText themeColor="textSecondary" style={{ fontWeight: '600' }}>Close</ThemedText>
          </Pressable>
        </Animated.View>
      )}

      {/* ── Chapter Selection Sheet ── */}
      {showChapterSheet && (
        <Animated.View
          entering={SlideInDown.duration(280).easing(Easing.out(Easing.cubic))}
          exiting={SlideOutDown.duration(200).easing(Easing.in(Easing.cubic))}
          style={[
            styles.bottomSheet,
            {
              backgroundColor: theme.backgroundElement,
              borderColor: theme.border,
              paddingBottom: bottomSafePadding + Spacing.three,
              maxHeight: SCREEN_HEIGHT * 0.7,
            },
          ]}
        >
          <View style={[styles.sheetHandle, { backgroundColor: theme.backgroundSelected }]} />
          <View style={styles.sheetHeaderRow}>
            <MaterialIcons name="format-list-bulleted" size={22} color={theme.accent} />
            <ThemedText style={styles.sheetTitle}>Chapters ({chapters.length})</ThemedText>
          </View>

          <ScrollView style={styles.chapterList} showsVerticalScrollIndicator={true}>
            {chapters.map((ch, idx) => {
              const isActive = ch.id === currentChapter?.id;
              const chDuration = ch.endTime > ch.startTime ? ch.endTime - ch.startTime : ch.duration;
              const titleText = ch.title.toLowerCase().startsWith('chapter')
                ? ch.title
                : `Chapter ${idx + 1} - ${ch.title}`;

              return (
                <Pressable
                  key={ch.id}
                  onPress={() => {
                    jumpToChapter(ch);
                    setShowChapterSheet(false);
                  }}
                  style={({ pressed }) => [
                    styles.chapterItem,
                    {
                      backgroundColor: isActive ? theme.backgroundSelected : 'transparent',
                      borderBottomColor: theme.border,
                      opacity: pressed ? 0.7 : 1,
                    },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={`Select Chapter ${idx + 1}: ${ch.title}`}
                >
                  <View style={styles.chapterItemLeft}>
                    <ThemedText
                      numberOfLines={1}
                      style={[
                        styles.chapterItemTitle,
                        isActive && { color: theme.accent, fontWeight: '700' },
                      ]}
                    >
                      {titleText}
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary" style={styles.chapterItemTime}>
                      {formatTime(ch.startTime)} {chDuration > 0 ? `· ${formatDuration(chDuration)}` : ''}
                    </ThemedText>
                  </View>
                  {isActive && (
                    <MaterialIcons name="graphic-eq" size={20} color={theme.accent} />
                  )}
                </Pressable>
              );
            })}
          </ScrollView>

          <Pressable
            onPress={() => setShowChapterSheet(false)}
            style={[styles.sheetCloseBtn, { backgroundColor: theme.backgroundSelected }]}
            accessibilityRole="button"
            accessibilityLabel="Close chapter selection sheet"
          >
            <ThemedText themeColor="textSecondary" style={{ fontWeight: '600' }}>Close</ThemedText>
          </Pressable>
        </Animated.View>
      )}

      {/* Dim backdrop for sheets */}
      {(showSpeedSheet || showSleepSheet || showBookmarkSheet || showChapterSheet) && (
        <Pressable
          style={styles.dimOverlay}
          onPress={closeAllSheets}
          accessibilityLabel="Close sheet"
          importantForAccessibility="no-hide-descendants"
        />
      )}
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingBottom: Spacing.four },

  noBookContainer: {
    flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.three,
  },
  noBookText: { textAlign: 'center' },
  backBtn: {
    paddingHorizontal: Spacing.four, paddingVertical: Spacing.two, borderRadius: Spacing.three,
  },

  // Error
  errorBanner: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.two,
    marginHorizontal: Spacing.three, marginBottom: Spacing.two,
    padding: Spacing.two + 4, borderRadius: Spacing.three,
  },
  errorText: { flex: 1, color: '#FF6B6B', fontSize: 13 },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.three, paddingTop: Spacing.two, paddingBottom: Spacing.two,
  },
  headerBtn: {
    width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
  },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerLabel: { letterSpacing: 1.2, fontSize: 11, fontWeight: '700' },
  sleepBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: Spacing.two, paddingVertical: 5, borderRadius: 100,
  },
  sleepBadgeText: { fontSize: 12, fontWeight: '600' },

  // Cover
  coverWrapper: { alignItems: 'center', paddingVertical: Spacing.three },
  coverContainer: {
    shadowColor: '#000', shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.45, shadowRadius: 24, elevation: 16,
  },
  coverImage: { width: COVER_SIZE, height: COVER_SIZE, borderRadius: Spacing.four },
  coverPlaceholder: {
    width: COVER_SIZE, height: COVER_SIZE, borderRadius: Spacing.four,
    alignItems: 'center', justifyContent: 'center',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFill,
    borderRadius: Spacing.four,
    backgroundColor: '#00000055',
    alignItems: 'center', justifyContent: 'center',
  },

  // Info
  infoSection: {
    paddingHorizontal: Spacing.four,
    marginTop: Spacing.five + Spacing.two, // 40px margin from cover art
    paddingBottom: Spacing.two,
    alignItems: 'center',
  },
  chapterSelectorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chapterTitle: { fontSize: 16, fontWeight: '700', lineHeight: 22, textAlign: 'center' },
  bookTitle: { fontSize: 13, marginTop: 4, textAlign: 'center' },
  chapterList: {
    maxHeight: SCREEN_HEIGHT * 0.45,
    marginVertical: Spacing.two,
  },
  chapterItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.two + 2,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  chapterItemLeft: {
    flex: 1,
    alignItems: 'center',
  },
  chapterItemTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
    textAlign: 'center',
  },
  chapterItemTime: {
    fontSize: 11,
    textAlign: 'center',
  },

  // Seek bar
  seekSection: { paddingHorizontal: Spacing.four, paddingBottom: Spacing.two },
  seekBarHitArea: {
    height: 36, justifyContent: 'center', position: 'relative', marginBottom: 2,
  },
  seekTrack: {
    height: 5, borderRadius: 2.5, overflow: 'hidden', position: 'relative',
    width: SEEK_BAR_WIDTH,
  },
  seekChapterRange: { position: 'absolute', height: '100%', top: 0 },
  seekFill: { position: 'absolute', height: '100%', left: 0, top: 0, borderRadius: 2.5 },
  seekThumb: {
    position: 'absolute', width: 16, height: 16, borderRadius: 8,
    top: '50%', marginTop: -10, // shifted to center over track
  },
  timeRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginTop: 2, marginBottom: Spacing.two,
  },
  chapterProgressLabel: { fontSize: 11 },

  // Controls
  controls: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.four, paddingVertical: Spacing.three,
  },
  controlBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 48,
    height: 48,
  },
  playBtn: {
    width: 72, height: 72, borderRadius: 36,
    alignItems: 'center', justifyContent: 'center',
  },

  // Countdown overlay
  countdownOverlay: {
    ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', zIndex: 50,
  },
  countdownCard: {
    width: SCREEN_WIDTH * 0.75, borderRadius: 24, padding: Spacing.five,
    alignItems: 'center', gap: Spacing.three,
  },
  countdownLabel: { fontSize: 11, letterSpacing: 1.5, fontWeight: '700' },
  countdownNumber: { fontSize: 72, fontWeight: '800', lineHeight: 80 },
  countdownButtons: { flexDirection: 'row', gap: Spacing.three, marginTop: Spacing.two },
  countdownBtn: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.two,
    paddingHorizontal: Spacing.three, paddingVertical: Spacing.two + 2, borderRadius: 100,
  },
  countdownBtnText: { fontWeight: '600', fontSize: 14 },

  // Bottom toolbar
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
  },
  bottomChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one + 2,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two + 2,
    borderRadius: 100,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  bottomChipText: { fontSize: 13, fontWeight: '700' },

  // Bottom sheets
  bottomSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    zIndex: 100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 32,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: Spacing.three,
  },
  sheetHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginBottom: Spacing.three,
  },
  sheetTitle: { fontSize: 18, fontWeight: '800' },
  sheetCloseBtn: {
    alignItems: 'center',
    paddingVertical: Spacing.two + 2,
    borderRadius: Spacing.three,
    marginTop: Spacing.two,
  },

  speedGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    marginBottom: Spacing.two,
  },
  speedOption: {
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two + 2,
    borderRadius: 100,
    minWidth: 64,
    alignItems: 'center',
    borderWidth: 1,
  },
  speedOptionText: { fontWeight: '700', fontSize: 15 },

  sleepGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    marginBottom: Spacing.two,
  },
  sleepOption: {
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two + 2,
    borderRadius: 100,
    minWidth: 60,
    alignItems: 'center',
    borderWidth: 1,
  },
  sleepOptionText: { fontWeight: '700', fontSize: 14 },
  clearTimerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: 100,
    marginBottom: Spacing.two,
    alignSelf: 'flex-start',
  },
  clearTimerText: { fontWeight: '700', fontSize: 13 },

  // Bookmark sheet
  bookmarkPosition: { fontSize: 13, marginBottom: Spacing.two },
  bookmarkInput: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.two,
    fontSize: 15,
    marginBottom: Spacing.three,
    borderWidth: 1,
  },
  bookmarkAddBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: Spacing.two, paddingVertical: Spacing.two + 4, borderRadius: Spacing.three,
    marginBottom: Spacing.three,
  },
  bookmarkAddText: { color: '#000', fontWeight: '700', fontSize: 15 },
  bookmarkList: { maxHeight: 160, marginBottom: Spacing.two },
  bookmarkItem: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.two,
    paddingVertical: Spacing.two, borderBottomWidth: 1,
  },
  bookmarkItemInfo: { flex: 1 },
  bookmarkItemNote: { fontSize: 14, fontWeight: '600' },

  // Dim overlay
  dimOverlay: {
    ...StyleSheet.absoluteFill, backgroundColor: '#00000070', zIndex: 30,
  },
});
