import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Dimensions,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { useSQLiteContext } from 'expo-sqlite';
import {
  ChevronDown,
  SkipBack,
  SkipForward,
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Bookmark,
  Timer,
  Music,
  X,
  Check,
} from 'lucide-react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
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
// Helper formatters
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

function formatRemaining(remaining: number): string {
  return `-${formatTime(remaining)}`;
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

// ---------------------------------------------------------------------------
// Seek Bar component
// ---------------------------------------------------------------------------

interface SeekBarProps {
  position: number;
  duration: number;
  chapterStart: number;
  chapterEnd: number;
  onSeek: (seconds: number) => void;
  accentColor: string;
  trackColor: string;
}

function SeekBar({
  position,
  duration,
  chapterStart,
  chapterEnd,
  onSeek,
  accentColor,
  trackColor,
}: SeekBarProps) {
  const [isSeeking, setIsSeeking] = useState(false);
  const [seekValue, setSeekValue] = useState(0);
  const barRef = useRef<View>(null);
  const barXRef = useRef<number>(0);

  const progress = duration > 0 ? Math.min(1, Math.max(0, position / duration)) : 0;
  const displayProgress = isSeeking ? seekValue : progress;

  const chapterStartRatio = duration > 0 ? chapterStart / duration : 0;
  const chapterEndRatio = duration > 0 ? chapterEnd / duration : 1;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        setIsSeeking(true);
        const ratio = Math.min(1, Math.max(0, (evt.nativeEvent.pageX - barXRef.current) / SEEK_BAR_WIDTH));
        setSeekValue(ratio);
      },
      onPanResponderMove: (evt) => {
        const ratio = Math.min(1, Math.max(0, (evt.nativeEvent.pageX - barXRef.current) / SEEK_BAR_WIDTH));
        setSeekValue(ratio);
      },
      onPanResponderRelease: (evt) => {
        const ratio = Math.min(1, Math.max(0, (evt.nativeEvent.pageX - barXRef.current) / SEEK_BAR_WIDTH));
        setIsSeeking(false);
        onSeek(ratio * duration);
      },
      onPanResponderTerminate: () => {
        setIsSeeking(false);
      },
    }),
  ).current;

  return (
    <View
      ref={barRef}
      style={[styles.seekBarHitArea]}
      onLayout={(e) => {
        barRef.current?.measure((_x, _y, _w, _h, pageX) => {
          barXRef.current = pageX;
        });
        e.nativeEvent.layout; // touch onLayout to avoid eslint warning
      }}
      {...panResponder.panHandlers}
    >
      {/* Full track background */}
      <View style={[styles.seekTrack, { backgroundColor: trackColor }]}>
        {/* Chapter range highlight */}
        <View
          style={[
            styles.seekChapterRange,
            {
              left: `${chapterStartRatio * 100}%`,
              width: `${(chapterEndRatio - chapterStartRatio) * 100}%`,
              backgroundColor: `${trackColor}AA`,
            },
          ]}
        />
        {/* Progress fill */}
        <View
          style={[
            styles.seekFill,
            { backgroundColor: accentColor, width: `${displayProgress * 100}%` },
          ]}
        />
      </View>
      {/* Thumb */}
      <View
        style={[
          styles.seekThumb,
          {
            backgroundColor: accentColor,
            left: `${displayProgress * 100}%`,
            transform: [{ translateX: -8 }, { scale: isSeeking ? 1.4 : 1 }],
          },
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
  const { autoplayCountdownRemaining, tickAutoplayCountdown, cancelAutoplayCountdown } =
    usePlaybackStore((s) => ({
      autoplayCountdownRemaining: s.autoplayCountdownRemaining,
      tickAutoplayCountdown: s.tickAutoplayCountdown,
      cancelAutoplayCountdown: s.cancelAutoplayCountdown,
    }));

  useEffect(() => {
    const id = setInterval(() => {
      tickAutoplayCountdown();
    }, 1000);
    return () => clearInterval(id);
  }, [tickAutoplayCountdown]);

  useEffect(() => {
    if (autoplayCountdownRemaining === 0) {
      onSkip();
    }
  }, [autoplayCountdownRemaining, onSkip]);

  return (
    <Animated.View
      entering={FadeIn.duration(250)}
      exiting={FadeOut.duration(200)}
      style={[styles.countdownOverlay, { backgroundColor: theme.background + 'EE' }]}
    >
      <View style={[styles.countdownCard, { backgroundColor: theme.backgroundElement }]}>
        <ThemedText themeColor="textSecondary" style={styles.countdownLabel}>
          Next Chapter
        </ThemedText>
        <ThemedText style={styles.countdownNumber}>{autoplayCountdownRemaining}</ThemedText>
        <View style={styles.countdownButtons}>
          <Pressable
            onPress={() => { cancelAutoplayCountdown(); onCancel(); }}
            style={[styles.countdownBtn, { backgroundColor: theme.backgroundSelected }]}
          >
            <X size={16} color={theme.text} />
            <ThemedText style={styles.countdownBtnText}>Cancel</ThemedText>
          </Pressable>
          <Pressable
            onPress={onSkip}
            style={[styles.countdownBtn, { backgroundColor: theme.accent }]}
          >
            <SkipForward size={16} color="#000" />
            <ThemedText style={[styles.countdownBtnText, { color: '#000' }]}>Skip Now</ThemedText>
          </Pressable>
        </View>
      </View>
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

  const [showSpeedSheet, setShowSpeedSheet] = useState(false);
  const [showSleepSheet, setShowSleepSheet] = useState(false);
  const [showBookmarkSheet, setShowBookmarkSheet] = useState(false);
  const [bookmarkNote, setBookmarkNote] = useState('');
  const [bookmarks, setBookmarks] = useState<BookmarkRecord[]>([]);

  // Cover scale animation
  const coverScale = useSharedValue(isPlaying ? 1 : 0.9);
  useEffect(() => {
    coverScale.value = withSpring(isPlaying ? 1 : 0.9, { damping: 12 });
  }, [isPlaying, coverScale]);
  const coverStyle = useAnimatedStyle(() => ({
    transform: [{ scale: coverScale.value }],
  }));

  // Start audio on mount if currentBook is set but player isn't playing
  useEffect(() => {
    if (!currentBook || !chapters.length) return;
    if (!player.isLoaded || !player.playing) {
      startBook(currentBook, chapters, position, true).catch(console.warn);
    }
  }, []); // Only on mount

  // Load bookmarks for bookmark sheet
  useEffect(() => {
    if (!currentBook) return;
    dbService.getBookmarksByBookId(db, currentBook.id)
      .then(setBookmarks)
      .catch(console.warn);
  }, [db, currentBook, showBookmarkSheet]);

  // ---------------------------------------------------------------------------
  // Computed values
  // ---------------------------------------------------------------------------

  const chapterStart = currentChapter?.startTime ?? 0;
  const chapterEnd = currentChapter?.endTime ?? (currentBook?.duration ?? 0);
  const bookDuration = currentBook?.duration ?? 0;
  const remaining = Math.max(0, bookDuration - position);

  const chapterProgress =
    chapterEnd > chapterStart
      ? Math.min(1, Math.max(0, (position - chapterStart) / (chapterEnd - chapterStart)))
      : 0;

  const currentChapterIndex = chapters.findIndex((ch) => ch.id === currentChapter?.id);
  const hasNextChapter = currentChapterIndex < chapters.length - 1;
  const hasPrevChapter = currentChapterIndex > 0;

  // ---------------------------------------------------------------------------
  // Sleep timer helpers
  // ---------------------------------------------------------------------------

  const sleepTimerLabel = (() => {
    if (!sleepTimerType) return null;
    if (sleepTimerType === 'chapter') return 'Chapter end';
    if (sleepTimerRemaining != null) return formatDuration(sleepTimerRemaining);
    return null;
  })();

  // ---------------------------------------------------------------------------
  // Autoplay countdown handlers
  // ---------------------------------------------------------------------------

  const handleAutoplaySkip = useCallback(async () => {
    cancelAutoplayCountdown();
    await nextChapter();
  }, [cancelAutoplayCountdown, nextChapter]);

  const handleAutoplayCancel = useCallback(() => {
    cancelAutoplayCountdown();
  }, [cancelAutoplayCountdown]);

  // ---------------------------------------------------------------------------
  // Bookmark add
  // ---------------------------------------------------------------------------

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
      // Refresh bookmarks
      const updated = await dbService.getBookmarksByBookId(db, currentBook.id);
      setBookmarks(updated);
    } catch (err) {
      console.warn('[Player] Failed to add bookmark:', err);
    }
  }, [db, currentBook, currentChapter, player, bookmarkNote]);

  // ---------------------------------------------------------------------------
  // Render nothing if no book loaded
  // ---------------------------------------------------------------------------

  if (!currentBook) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.noBookContainer}>
          <Music size={48} color={theme.textSecondary} />
          <ThemedText themeColor="textSecondary" style={styles.noBookText}>
            No audiobook selected.
          </ThemedText>
          <Pressable onPress={() => router.back()} style={[styles.backBtn, { backgroundColor: theme.backgroundElement }]}>
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
        {/* Header */}
        <Animated.View entering={FadeInDown.duration(300)} style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            style={({ pressed }) => [
              styles.headerBtn,
              { backgroundColor: pressed ? theme.backgroundElement : 'transparent' },
            ]}
          >
            <ChevronDown size={28} color={theme.text} />
          </Pressable>

          <View style={styles.headerCenter}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.headerLabel}>
              Now Playing
            </ThemedText>
          </View>

          {/* Sleep timer badge */}
          {sleepTimerLabel && (
            <Pressable
              onPress={() => setShowSleepSheet(true)}
              style={[styles.sleepBadge, { backgroundColor: theme.backgroundElement }]}
            >
              <Timer size={12} color={theme.accent} />
              <ThemedText style={[styles.sleepBadgeText, { color: theme.accent }]}>
                {sleepTimerLabel}
              </ThemedText>
            </Pressable>
          )}
          {!sleepTimerLabel && <View style={styles.headerBtn} />}
        </Animated.View>

        {/* Cover Art */}
        <Animated.View entering={FadeIn.duration(400)} style={styles.coverWrapper}>
          <Animated.View style={[styles.coverContainer, coverStyle]}>
            {currentBook.coverPath ? (
              <Image
                source={{ uri: currentBook.coverPath }}
                style={styles.coverImage}
                contentFit="cover"
              />
            ) : (
              <View style={[styles.coverPlaceholder, { backgroundColor: theme.backgroundElement }]}>
                <Music size={72} color={theme.textSecondary} />
              </View>
            )}
          </Animated.View>
        </Animated.View>

        {/* Book & Chapter Info */}
        <Animated.View entering={FadeInDown.delay(100).duration(300)} style={styles.infoSection}>
          <ThemedText numberOfLines={2} style={styles.chapterTitle}>
            {currentChapter?.title ?? currentBook.title}
          </ThemedText>
          <ThemedText numberOfLines={1} themeColor="textSecondary" style={styles.bookTitle}>
            {currentBook.title}
            {currentBook.author ? ` · ${currentBook.author}` : ''}
          </ThemedText>

          {/* Add bookmark shortcut */}
          <Pressable
            onPress={() => setShowBookmarkSheet(true)}
            hitSlop={8}
            style={styles.bookmarkQuickBtn}
          >
            <Bookmark size={20} color={theme.textSecondary} />
          </Pressable>
        </Animated.View>

        {/* Seek Bar */}
        <Animated.View entering={FadeInDown.delay(150).duration(300)} style={styles.seekSection}>
          <SeekBar
            position={position}
            duration={bookDuration}
            chapterStart={chapterStart}
            chapterEnd={chapterEnd}
            onSeek={seekTo}
            accentColor={theme.accent}
            trackColor={theme.backgroundElement}
          />

          {/* Time labels */}
          <View style={styles.timeRow}>
            <ThemedText type="small" themeColor="textSecondary">
              {formatTime(position)}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.chapterProgressLabel}>
              Chapter {currentChapterIndex + 1}/{chapters.length}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {formatRemaining(remaining)}
            </ThemedText>
          </View>

          {/* Chapter seek bar */}
          <View style={[styles.chapterSeekBg, { backgroundColor: theme.backgroundElement }]}>
            <View
              style={[
                styles.chapterSeekFill,
                { backgroundColor: theme.accent + '66', width: `${chapterProgress * 100}%` },
              ]}
            />
          </View>
          <ThemedText type="small" themeColor="textSecondary" style={styles.chapterLabel}>
            {currentChapter?.title ?? ''}
          </ThemedText>
        </Animated.View>

        {/* Playback Controls */}
        <Animated.View entering={FadeInDown.delay(200).duration(300)} style={styles.controls}>
          {/* Previous chapter */}
          <Pressable
            onPress={prevChapter}
            disabled={!hasPrevChapter}
            hitSlop={12}
            style={({ pressed }) => [
              styles.controlBtn,
              { opacity: pressed || !hasPrevChapter ? 0.4 : 1 },
            ]}
          >
            <SkipBack size={28} color={theme.text} fill={hasPrevChapter ? theme.text : 'none'} />
          </Pressable>

          {/* Skip back 30s */}
          <Pressable
            onPress={() => skipBackward(30)}
            hitSlop={12}
            style={({ pressed }) => [styles.controlBtn, { opacity: pressed ? 0.6 : 1 }]}
          >
            <RotateCcw size={26} color={theme.text} />
            <ThemedText style={styles.skipLabel}>30</ThemedText>
          </Pressable>

          {/* Play / Pause */}
          <Pressable
            onPress={togglePlayPause}
            style={({ pressed }) => [
              styles.playBtn,
              { backgroundColor: theme.accent, opacity: pressed ? 0.85 : 1 },
            ]}
          >
            {isPlaying ? (
              <Pause size={32} color="#000" fill="#000" />
            ) : (
              <Play size={32} color="#000" fill="#000" style={{ marginLeft: 3 }} />
            )}
          </Pressable>

          {/* Skip forward 30s */}
          <Pressable
            onPress={() => skipForward(30)}
            hitSlop={12}
            style={({ pressed }) => [styles.controlBtn, { opacity: pressed ? 0.6 : 1 }]}
          >
            <RotateCw size={26} color={theme.text} />
            <ThemedText style={styles.skipLabel}>30</ThemedText>
          </Pressable>

          {/* Next chapter */}
          <Pressable
            onPress={nextChapter}
            disabled={!hasNextChapter}
            hitSlop={12}
            style={({ pressed }) => [
              styles.controlBtn,
              { opacity: pressed || !hasNextChapter ? 0.4 : 1 },
            ]}
          >
            <SkipForward size={28} color={theme.text} fill={hasNextChapter ? theme.text : 'none'} />
          </Pressable>
        </Animated.View>

        {/* Bottom row: Speed | Chapters | Sleep Timer */}
        <Animated.View entering={FadeInDown.delay(250).duration(300)} style={styles.bottomRow}>
          {/* Speed */}
          <Pressable
            onPress={() => setShowSpeedSheet(true)}
            style={[styles.bottomChip, { backgroundColor: theme.backgroundElement }]}
          >
            <ThemedText style={[styles.bottomChipText, { color: theme.accent }]}>
              {speed === 1.0 ? '1×' : `${speed}×`}
            </ThemedText>
          </Pressable>

          {/* Bookmark */}
          <Pressable
            onPress={() => setShowBookmarkSheet(true)}
            style={[styles.bottomChip, { backgroundColor: theme.backgroundElement }]}
          >
            <Bookmark size={16} color={theme.text} />
            <ThemedText style={styles.bottomChipText}>Mark</ThemedText>
          </Pressable>

          {/* Sleep Timer */}
          <Pressable
            onPress={() => setShowSleepSheet(true)}
            style={[
              styles.bottomChip,
              { backgroundColor: sleepTimerType ? theme.accent : theme.backgroundElement },
            ]}
          >
            <Timer size={16} color={sleepTimerType ? '#000' : theme.text} />
            <ThemedText style={[styles.bottomChipText, sleepTimerType ? { color: '#000' } : {}]}>
              {sleepTimerLabel ?? 'Sleep'}
            </ThemedText>
          </Pressable>
        </Animated.View>
      </ScrollView>

      {/* ─── Autoplay Countdown overlay ─── */}
      {isAutoplayCountdown && (
        <AutoplayCountdown onSkip={handleAutoplaySkip} onCancel={handleAutoplayCancel} />
      )}

      {/* ─── Speed Sheet ─── */}
      {showSpeedSheet && (
        <Animated.View
          entering={FadeIn.duration(200)}
          style={[styles.bottomSheet, { backgroundColor: theme.backgroundElement }]}
        >
          <View style={styles.sheetHandle} />
          <ThemedText style={styles.sheetTitle}>Playback Speed</ThemedText>
          <View style={styles.speedGrid}>
            {SPEED_OPTIONS.map((s) => (
              <Pressable
                key={s}
                onPress={() => { setSpeed(s); setShowSpeedSheet(false); }}
                style={[
                  styles.speedOption,
                  {
                    backgroundColor:
                      speed === s ? theme.accent : theme.backgroundSelected,
                  },
                ]}
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
          >
            <ThemedText themeColor="textSecondary">Close</ThemedText>
          </Pressable>
        </Animated.View>
      )}

      {/* ─── Sleep Timer Sheet ─── */}
      {showSleepSheet && (
        <Animated.View
          entering={FadeIn.duration(200)}
          style={[styles.bottomSheet, { backgroundColor: theme.backgroundElement }]}
        >
          <View style={styles.sheetHandle} />
          <ThemedText style={styles.sheetTitle}>Sleep Timer</ThemedText>
          {sleepTimerType && (
            <Pressable
              onPress={() => { clearSleepTimer(); setShowSleepSheet(false); }}
              style={[styles.clearTimerBtn, { backgroundColor: theme.backgroundSelected }]}
            >
              <X size={16} color={theme.text} />
              <ThemedText style={styles.clearTimerText}>Cancel timer</ThemedText>
            </Pressable>
          )}
          <View style={styles.sleepGrid}>
            {SLEEP_OPTIONS.map((opt) => (
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
                  {
                    backgroundColor:
                      (sleepTimerType === 'time' &&
                        typeof opt.value === 'number' &&
                        opt.value === usePlaybackStore.getState().sleepTimerDuration)
                        ? theme.accent
                        : (sleepTimerType === 'chapter' && opt.value === 'chapter')
                        ? theme.accent
                        : theme.backgroundSelected,
                    flex: opt.value === 'chapter' ? 1 : undefined,
                  },
                ]}
              >
                <ThemedText style={styles.sleepOptionText}>{opt.label}</ThemedText>
              </Pressable>
            ))}
          </View>
          <Pressable
            onPress={() => setShowSleepSheet(false)}
            style={[styles.sheetCloseBtn, { backgroundColor: theme.backgroundSelected }]}
          >
            <ThemedText themeColor="textSecondary">Close</ThemedText>
          </Pressable>
        </Animated.View>
      )}

      {/* ─── Bookmark Sheet ─── */}
      {showBookmarkSheet && (
        <Animated.View
          entering={FadeIn.duration(200)}
          style={[styles.bottomSheet, { backgroundColor: theme.backgroundElement }]}
        >
          <View style={styles.sheetHandle} />
          <ThemedText style={styles.sheetTitle}>Add Bookmark</ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.bookmarkPosition}>
            {currentChapter?.title ?? ''} · {formatTime(position)}
          </ThemedText>
          <Pressable
            onPress={handleAddBookmark}
            style={[styles.bookmarkAddBtn, { backgroundColor: theme.accent }]}
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
          >
            <ThemedText themeColor="textSecondary">Close</ThemedText>
          </Pressable>
        </Animated.View>
      )}

      {/* Dim overlay when a sheet is open */}
      {(showSpeedSheet || showSleepSheet || showBookmarkSheet) && (
        <Pressable
          style={styles.dimOverlay}
          onPress={() => {
            setShowSpeedSheet(false);
            setShowSleepSheet(false);
            setShowBookmarkSheet(false);
          }}
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

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.three, paddingTop: Spacing.two, paddingBottom: Spacing.two,
  },
  headerBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerLabel: { letterSpacing: 1 },
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

  // Info
  infoSection: {
    paddingHorizontal: Spacing.four, paddingBottom: Spacing.two, position: 'relative',
  },
  chapterTitle: { fontSize: 22, fontWeight: '800', lineHeight: 28, paddingRight: 40 },
  bookTitle: { fontSize: 14, marginTop: 4 },
  bookmarkQuickBtn: {
    position: 'absolute', right: Spacing.four, top: 0,
    padding: Spacing.two,
  },

  // Seek bar
  seekSection: { paddingHorizontal: Spacing.four, paddingBottom: Spacing.two },
  seekBarHitArea: {
    height: 36, justifyContent: 'center', position: 'relative', marginBottom: 2,
  },
  seekTrack: {
    height: 4, borderRadius: 2, overflow: 'hidden', position: 'relative',
  },
  seekChapterRange: { position: 'absolute', height: '100%', top: 0 },
  seekFill: { position: 'absolute', height: '100%', left: 0, top: 0, borderRadius: 2 },
  seekThumb: {
    position: 'absolute', width: 16, height: 16, borderRadius: 8,
    top: '50%', marginTop: -8,
  },
  timeRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginTop: 2, marginBottom: Spacing.two,
  },
  chapterProgressLabel: { fontSize: 11 },
  chapterSeekBg: {
    height: 2, borderRadius: 1, overflow: 'hidden', marginTop: 2,
  },
  chapterSeekFill: { height: '100%', borderRadius: 1 },
  chapterLabel: { textAlign: 'center', marginTop: 4, fontSize: 12 },

  // Controls
  controls: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.four, paddingVertical: Spacing.three,
  },
  controlBtn: {
    alignItems: 'center', justifyContent: 'center', position: 'relative',
    width: 52, height: 52,
  },
  skipLabel: {
    position: 'absolute', fontSize: 9, fontWeight: '700', bottom: 8,
  },
  playBtn: {
    width: 72, height: 72, borderRadius: 36,
    alignItems: 'center', justifyContent: 'center',
  },

  // Bottom row
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

  // Autoplay Countdown
  countdownOverlay: {
    ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', zIndex: 50,
  },
  countdownCard: {
    width: SCREEN_WIDTH * 0.75, borderRadius: 20, padding: Spacing.five,
    alignItems: 'center', gap: Spacing.three,
  },
  countdownLabel: { fontSize: 13, letterSpacing: 1 },
  countdownNumber: {
    fontSize: 72, fontWeight: '800', lineHeight: 80,
  },
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
    shadowOpacity: 0.3, shadowRadius: 12, elevation: 20,
  },
  sheetHandle: {
    width: 36, height: 4, borderRadius: 2, backgroundColor: '#ffffff33',
    alignSelf: 'center', marginBottom: Spacing.three,
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
    ...StyleSheet.absoluteFill, backgroundColor: '#00000066', zIndex: 30,
  },
});
