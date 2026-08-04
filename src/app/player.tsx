import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Dimensions,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  ActivityIndicator,
  AccessibilityInfo,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import Svg, { Path, Text as SvgText } from 'react-native-svg';
import { useSQLiteContext } from 'expo-sqlite';
import {
  ChevronDown,
  SkipBack,
  SkipForward,
  Play,
  Pause,
  Bookmark,
  Timer,
  Music,
  X,
  Check,
  AlertCircle,
} from 'lucide-react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeOut,
  SlideInDown,
  SlideOutDown,
  ZoomIn,
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

const { width: SCREEN_WIDTH } = Dimensions.get('window');
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

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function SkipBackIcon({ size = 36, color = '#FFF', seconds = 30 }: { size?: number; color?: string; seconds?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M3.5 9.5C4.8 5.7 8.4 3 12.5 3C17.7 3 22 7.3 22 12.5C22 17.7 17.7 22 12.5 22C8.1 22 4.3 19 3.2 15"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <Path
        d="M3.5 4.5V9.5H8.5"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <SvgText
        x="12.2"
        y="15.5"
        fontSize="8"
        fontWeight="800"
        fill={color}
        textAnchor="middle"
      >
        {seconds}
      </SvgText>
    </Svg>
  );
}

function SkipForwardIcon({ size = 36, color = '#FFF', seconds = 30 }: { size?: number; color?: string; seconds?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M20.5 9.5C19.2 5.7 15.6 3 11.5 3C6.3 3 2 7.3 2 12.5C2 17.7 6.3 22 11.5 22C15.9 22 19.7 19 20.8 15"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <Path
        d="M20.5 4.5V9.5H15.5"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <SvgText
        x="11.8"
        y="15.5"
        fontSize="8"
        fontWeight="800"
        fill={color}
        textAnchor="middle"
      >
        {seconds}
      </SvgText>
    </Svg>
  );
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
  const [isDragging, setIsDragging] = useState(false);
  const barXRef = useRef<number>(0);

  const isChapterMode = mode === 'chapter';
  const effectiveStart = isChapterMode ? chapterStart : 0;
  const effectiveEnd = isChapterMode ? chapterEnd : duration;
  const effectiveDuration = Math.max(1, effectiveEnd - effectiveStart);
  const currentOffset = Math.max(0, Math.min(effectiveDuration, position - effectiveStart));
  const currentRatio = currentOffset / effectiveDuration;

  // Reanimated shared value for smooth interpolation between 250ms updates
  const progressSV = useSharedValue(currentRatio);

  useEffect(() => {
    if (!isDragging && effectiveDuration > 0) {
      progressSV.value = withTiming(Math.min(1, Math.max(0, currentRatio)), {
        duration: 240,
        easing: Easing.linear,
      });
    }
  }, [currentRatio, effectiveDuration, isDragging, progressSV]);

  const fillStyle = useAnimatedStyle(() => ({
    width: progressSV.value * SEEK_BAR_WIDTH,
  }));

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: progressSV.value * SEEK_BAR_WIDTH - 8 }],
  }));

  const chapterStartPx = duration > 0 ? (chapterStart / duration) * SEEK_BAR_WIDTH : 0;
  const chapterWidthPx =
    duration > 0
      ? ((chapterEnd - chapterStart) / duration) * SEEK_BAR_WIDTH
      : SEEK_BAR_WIDTH;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        setIsDragging(true);
        const ratio = Math.min(1, Math.max(0, (evt.nativeEvent.pageX - barXRef.current) / SEEK_BAR_WIDTH));
        progressSV.value = ratio;
      },
      onPanResponderMove: (evt) => {
        const ratio = Math.min(1, Math.max(0, (evt.nativeEvent.pageX - barXRef.current) / SEEK_BAR_WIDTH));
        progressSV.value = ratio;
      },
      onPanResponderRelease: (evt) => {
        const ratio = Math.min(1, Math.max(0, (evt.nativeEvent.pageX - barXRef.current) / SEEK_BAR_WIDTH));
        setIsDragging(false);
        onSeek(effectiveStart + ratio * effectiveDuration);
      },
      onPanResponderTerminate: () => {
        setIsDragging(false);
      },
    }),
  ).current;

  return (
    <View
      style={styles.seekBarHitArea}
      onLayout={(e) => {
        const el = e.target as unknown as { measure: Function };
        el.measure((_x: number, _y: number, _w: number, _h: number, pageX: number) => {
          barXRef.current = pageX;
        });
      }}
      accessibilityRole="adjustable"
      accessibilityLabel={`Progress: ${formatTime(currentOffset)} of ${formatTime(effectiveDuration)}`}
      accessibilityValue={{ min: 0, max: effectiveDuration, now: Math.floor(currentOffset) }}
      accessibilityActions={[
        { name: 'increment', label: 'Skip forward 30 seconds' },
        { name: 'decrement', label: 'Skip back 30 seconds' },
      ]}
      {...panResponder.panHandlers}
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
        entering={ZoomIn.springify().damping(14)}
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
            <X size={16} color={theme.text} />
            <ThemedText style={styles.countdownBtnText}>Cancel</ThemedText>
          </Pressable>
          <Pressable
            onPress={onSkip}
            style={[styles.countdownBtn, { backgroundColor: theme.accent }]}
            accessibilityRole="button"
            accessibilityLabel="Skip to next chapter now"
          >
            <SkipForward size={16} color="#000" />
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
  const {
    play,
    pause,
    togglePlayPause,
    seekTo,
    skipForward,
    skipBackward,
    nextChapter,
    prevChapter,
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
  const [bookmarkNote, setBookmarkNote] = useState('');
  const [bookmarks, setBookmarks] = useState<BookmarkRecord[]>([]);
  const [timeDisplayMode, setTimeDisplayMode] = useState<'chapter' | 'book'>('chapter');

  // Notify store that player screen is open (hides mini-player)
  useEffect(() => {
    setIsPlayerVisible(true);
    return () => setIsPlayerVisible(false);
  }, [setIsPlayerVisible]);

  // Cover scale animation tied to play state
  const coverScale = useSharedValue(isPlaying ? 1 : 0.9);
  useEffect(() => {
    coverScale.value = withSpring(isPlaying ? 1 : 0.9, { damping: 12, stiffness: 100 });
  }, [isPlaying, coverScale]);
  const coverStyle = useAnimatedStyle(() => ({
    transform: [{ scale: coverScale.value }],
  }));

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
          <Music size={48} color={theme.textSecondary} />
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
            <ChevronDown size={28} color={theme.text} />
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
              <Timer size={12} color={theme.accent} />
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
            <AlertCircle size={16} color="#FF6B6B" />
            <ThemedText style={styles.errorText} numberOfLines={2}>
              {playbackError}
            </ThemedText>
            <Pressable
              onPress={handleDismissError}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Dismiss error"
            >
              <X size={16} color="#FF6B6B" />
            </Pressable>
          </Animated.View>
        )}

        {/* ── Cover Art (ZoomIn entrance animation) ── */}
        <Animated.View entering={ZoomIn.duration(450).springify().damping(16)} style={styles.coverWrapper}>
          <Animated.View style={[styles.coverContainer, coverStyle]}>
            {currentBook.coverPath ? (
              <Image
                source={{ uri: currentBook.coverPath }}
                style={styles.coverImage}
                contentFit="cover"
                accessibilityLabel={`Cover art for ${currentBook.title}`}
              />
            ) : (
              <View style={[styles.coverPlaceholder, { backgroundColor: theme.backgroundElement }]}>
                <Music size={72} color={theme.textSecondary} />
              </View>
            )}

            {/* Loading spinner overlay */}
            {!isLoaded && (
              <View style={styles.loadingOverlay}>
                <ActivityIndicator size="large" color={theme.accent} />
              </View>
            )}
          </Animated.View>
        </Animated.View>

        {/* ── Book & Chapter Info ── */}
        <Animated.View entering={FadeInDown.delay(100).duration(300)} style={styles.infoSection}>
          <ThemedText
            numberOfLines={2}
            style={styles.chapterTitle}
            accessibilityRole="header"
          >
            {currentChapter?.title ?? currentBook.title}
          </ThemedText>
          <ThemedText numberOfLines={1} themeColor="textSecondary" style={styles.bookTitle}>
            {currentBook.title}
            {currentBook.author ? ` · ${currentBook.author}` : ''}
          </ThemedText>

          <Pressable
            onPress={() => setShowBookmarkSheet(true)}
            hitSlop={8}
            style={styles.bookmarkQuickBtn}
            accessibilityRole="button"
            accessibilityLabel="Add bookmark at current position"
          >
            <Bookmark size={20} color={theme.textSecondary} />
          </Pressable>
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
            <ThemedText type="small" themeColor="textSecondary" style={styles.chapterProgressLabel}>
              {currentChapterIndex + 1}/{chapters.length}
            </ThemedText>
            <Pressable
              onPress={() => setTimeDisplayMode((m) => (m === 'chapter' ? 'book' : 'chapter'))}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={`Remaining ${timeDisplayMode} time: ${formatRemaining(displayRemaining, displayTotalDuration)}. Tap to toggle mode.`}
            >
              <ThemedText type="small" themeColor="textSecondary">
                {formatRemaining(displayRemaining, displayTotalDuration)}
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
            <SkipBack size={28} color={theme.text} fill={hasPrevChapter ? theme.text : 'none'} />
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
              <Pause size={32} color="#000" fill="#000" />
            ) : (
              <Play size={32} color="#000" fill="#000" style={{ marginLeft: 3 }} />
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
            <SkipForward size={28} color={theme.text} fill={hasNextChapter ? theme.text : 'none'} />
          </Pressable>
        </Animated.View>

        {/* ── Bottom toolbar: Speed | Bookmark | Sleep Timer ── */}
        <Animated.View entering={FadeInDown.delay(250).duration(300)} style={styles.bottomRow}>
          <Pressable
            onPress={() => setShowSpeedSheet(true)}
            style={[styles.bottomChip, { backgroundColor: theme.backgroundElement }]}
            accessibilityRole="button"
            accessibilityLabel={`Playback speed: ${speed === 1.0 ? '1×' : `${speed}×`}. Tap to change.`}
          >
            <ThemedText style={[styles.bottomChipText, { color: theme.accent }]}>
              {speed === 1.0 ? '1×' : `${speed}×`}
            </ThemedText>
          </Pressable>

          <Pressable
            onPress={() => setShowBookmarkSheet(true)}
            style={[styles.bottomChip, { backgroundColor: theme.backgroundElement }]}
            accessibilityRole="button"
            accessibilityLabel="Add bookmark"
          >
            <Bookmark size={16} color={theme.text} />
            <ThemedText style={styles.bottomChipText}>Mark</ThemedText>
          </Pressable>

          <Pressable
            onPress={() => setShowSleepSheet(true)}
            style={[
              styles.bottomChip,
              { backgroundColor: sleepTimerType ? theme.accent : theme.backgroundElement },
            ]}
            accessibilityRole="button"
            accessibilityLabel={
              sleepTimerLabel
                ? `Sleep timer active: ${sleepTimerLabel}. Tap to change.`
                : 'Set sleep timer'
            }
          >
            <Timer size={16} color={sleepTimerType ? '#000' : theme.text} />
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

      {/* ── Speed Sheet ── */}
      {showSpeedSheet && (
        <Animated.View
          entering={SlideInDown.springify().damping(18).stiffness(150)}
          exiting={SlideOutDown.duration(220)}
          style={[styles.bottomSheet, { backgroundColor: theme.backgroundElement }]}
        >
          <View style={[styles.sheetHandle, { backgroundColor: theme.backgroundSelected }]} />
          <ThemedText style={styles.sheetTitle}>Playback Speed</ThemedText>
          <View style={styles.speedGrid}>
            {SPEED_OPTIONS.map((s) => (
              <Pressable
                key={s}
                onPress={() => { setSpeed(s); setShowSpeedSheet(false); }}
                style={[
                  styles.speedOption,
                  { backgroundColor: speed === s ? theme.accent : theme.backgroundSelected },
                ]}
                accessibilityRole="button"
                accessibilityLabel={`${s === 1.0 ? '1×' : `${s}×`} speed`}
                accessibilityState={{ selected: speed === s }}
              >
                <ThemedText
                  style={[styles.speedOptionText, speed === s ? { color: '#000' } : {}]}
                >
                  {s === 1.0 ? '1×' : `${s}×`}
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
            <ThemedText themeColor="textSecondary">Close</ThemedText>
          </Pressable>
        </Animated.View>
      )}

      {/* ── Sleep Timer Sheet ── */}
      {showSleepSheet && (
        <Animated.View
          entering={SlideInDown.springify().damping(18).stiffness(150)}
          exiting={SlideOutDown.duration(220)}
          style={[styles.bottomSheet, { backgroundColor: theme.backgroundElement }]}
        >
          <View style={[styles.sheetHandle, { backgroundColor: theme.backgroundSelected }]} />
          <ThemedText style={styles.sheetTitle}>Sleep Timer</ThemedText>
          {sleepTimerType && (
            <Pressable
              onPress={() => { clearSleepTimer(); setShowSleepSheet(false); }}
              style={[styles.clearTimerBtn, { backgroundColor: theme.backgroundSelected }]}
              accessibilityRole="button"
              accessibilityLabel="Cancel sleep timer"
            >
              <X size={16} color={theme.text} />
              <ThemedText style={styles.clearTimerText}>Cancel timer</ThemedText>
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
                  style={[
                    styles.sleepOption,
                    { backgroundColor: isActive ? theme.accent : theme.backgroundSelected },
                    opt.value === 'chapter' && { flex: 1 },
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
            <ThemedText themeColor="textSecondary">Close</ThemedText>
          </Pressable>
        </Animated.View>
      )}

      {/* ── Bookmark Sheet ── */}
      {showBookmarkSheet && (
        <Animated.View
          entering={SlideInDown.springify().damping(18).stiffness(150)}
          exiting={SlideOutDown.duration(220)}
          style={[styles.bottomSheet, { backgroundColor: theme.backgroundElement }]}
        >
          <View style={[styles.sheetHandle, { backgroundColor: theme.backgroundSelected }]} />
          <ThemedText style={styles.sheetTitle}>Add Bookmark</ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.bookmarkPosition}>
            {currentChapter?.title ?? ''} · {formatTime(position)}
          </ThemedText>
          <TextInput
            style={[
              styles.bookmarkInput,
              {
                color: theme.text,
                backgroundColor: theme.backgroundSelected,
                borderColor: theme.backgroundSelected,
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
            style={[styles.bookmarkAddBtn, { backgroundColor: theme.accent }]}
            accessibilityRole="button"
            accessibilityLabel="Save bookmark at current position"
          >
            <Check size={18} color="#000" />
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
                    style={[styles.bookmarkItem, { borderBottomColor: theme.backgroundSelected }]}
                    accessibilityRole="button"
                    accessibilityLabel={`Bookmark: ${bm.note ?? formatTime(bm.position)}, in ${bmChapter?.title ?? 'unknown chapter'}`}
                  >
                    <Bookmark size={14} color={theme.accent} />
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
            <ThemedText themeColor="textSecondary">Close</ThemedText>
          </Pressable>
        </Animated.View>
      )}

      {/* Dim backdrop for sheets */}
      {(showSpeedSheet || showSleepSheet || showBookmarkSheet) && (
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
    paddingHorizontal: Spacing.four, paddingBottom: Spacing.two, position: 'relative',
  },
  chapterTitle: { fontSize: 22, fontWeight: '800', lineHeight: 28, paddingRight: 40 },
  bookTitle: { fontSize: 14, marginTop: 4 },
  bookmarkQuickBtn: {
    position: 'absolute', right: Spacing.four, top: 0, padding: Spacing.two,
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

  // Bottom toolbar
  bottomRow: {
    flexDirection: 'row', justifyContent: 'center', gap: Spacing.three,
    paddingHorizontal: Spacing.four, paddingTop: Spacing.two,
  },
  bottomChip: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.one + 2,
    paddingHorizontal: Spacing.three, paddingVertical: Spacing.two,
    borderRadius: 100,
  },
  bottomChipText: { fontSize: 13, fontWeight: '600' },

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

  // Bottom sheets
  bottomSheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: Spacing.four, paddingBottom: Spacing.five,
    zIndex: 40,
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.35, shadowRadius: 16, elevation: 24,
  },
  sheetHandle: {
    width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: Spacing.three,
  },
  sheetTitle: { fontSize: 17, fontWeight: '700', marginBottom: Spacing.three },
  sheetCloseBtn: {
    alignItems: 'center', paddingVertical: Spacing.two + 2,
    borderRadius: Spacing.three, marginTop: Spacing.two,
  },

  speedGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, marginBottom: Spacing.two,
  },
  speedOption: {
    paddingHorizontal: Spacing.three, paddingVertical: Spacing.two,
    borderRadius: 100, minWidth: 60, alignItems: 'center',
  },
  speedOptionText: { fontWeight: '700', fontSize: 15 },

  sleepGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, marginBottom: Spacing.two,
  },
  sleepOption: {
    paddingHorizontal: Spacing.three, paddingVertical: Spacing.two,
    borderRadius: 100, minWidth: 56, alignItems: 'center',
  },
  sleepOptionText: { fontWeight: '600', fontSize: 14 },
  clearTimerBtn: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.two,
    paddingHorizontal: Spacing.three, paddingVertical: Spacing.two,
    borderRadius: 100, marginBottom: Spacing.two, alignSelf: 'flex-start',
  },
  clearTimerText: { fontWeight: '600' },

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
