import React, { useCallback, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Dimensions,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import { Image } from 'expo-image';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

// UI Primitives from src/components/ui
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Toggle } from '@/components/ui/toggle';
import { Slider } from '@/components/ui/slider';
import { Text } from '@/components/ui/text';

// Hooks & Navigation
import { useTheme } from '@/hooks/use-theme';
import { usePlaybackStore } from '@/hooks/use-playback-store';
import { useSettingsStore } from '@/hooks/use-settings-store';
import { usePlayerContext } from '@/features/player/components/playback-provider';
import { safeGoBack } from '@/utils/navigation';
import { AnimatedPlayButton } from '@/features/player/components/AnimatedPlayButton';
import { PlayerPanGestureContainer } from '@/features/player/components/PlayerPanGestureContainer';

export interface PlayerScreenProps {
  onClose?: () => void;
  onOpenSpeedSheet?: () => void;
  onOpenSleepSheet?: () => void;
  onOpenChapterSheet?: () => void;
  onOpenBookmarkSheet?: () => void;
}

const SPEED_PRESETS = [1.0, 1.25, 1.5, 1.75, 2.0, 0.8];

function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '0:00';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hrs > 0) {
    return `${hrs}:${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
  }
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

function formatRemainingTime(position: number, duration: number): string {
  const remaining = Math.max(0, duration - position);
  return `-${formatTime(remaining)}`;
}

// ---------------------------------------------------------------------------
// Fine-grained Sub-components (isolated Zustand selectors prevent top-level re-renders)
// ---------------------------------------------------------------------------

const PlayerHeaderSection = React.memo(function PlayerHeaderSection({
  onClose,
  onOpenChapterSheet,
}: {
  onClose: () => void;
  onOpenChapterSheet?: () => void;
}) {
  const theme = useTheme();
  const titleText = usePlaybackStore((s) => s.currentBook?.title || 'No Audiobook Selected');
  const chapterText = usePlaybackStore((s) => s.currentChapter?.title || 'Chapter 1');

  return (
    <View style={styles.header}>
      <Button
        variant="ghost"
        size="icon"
        onPress={onClose}
        accessibilityLabel="Minimize player"
        accessibilityRole="button"
        style={styles.headerButton}
      >
        <MaterialIcons name="keyboard-arrow-down" size={32} color={theme.text} />
      </Button>

      <View style={styles.headerTitleContainer}>
        <Text variant="h3" numberOfLines={1} align="center" style={styles.headerTitle}>
          {titleText}
        </Text>
        <Text variant="subhead" numberOfLines={1} align="center" style={styles.headerSubtitle}>
          {chapterText}
        </Text>
      </View>

      <Button
        variant="ghost"
        size="icon"
        onPress={onOpenChapterSheet}
        accessibilityLabel="Chapter list"
        accessibilityRole="button"
        style={styles.headerButton}
      >
        <MaterialIcons name="format-list-bulleted" size={24} color={theme.text} />
      </Button>
    </View>
  );
});

const PlayerCoverArtSection = React.memo(function PlayerCoverArtSection() {
  const theme = useTheme();
  const coverPath = usePlaybackStore((s) => s.currentBook?.coverPath);
  const titleText = usePlaybackStore((s) => s.currentBook?.title || 'No Audiobook Selected');

  return (
    <Card style={[styles.coverCard, { backgroundColor: theme.card }]}>
      <CardContent style={styles.coverCardContent}>
        {coverPath ? (
          <Image
            source={{ uri: coverPath }}
            style={styles.coverImage}
            contentFit="cover"
            transition={300}
            accessibilityLabel={`${titleText} cover art`}
          />
        ) : (
          <View style={[styles.coverPlaceholder, { backgroundColor: theme.backgroundElement }]}>
            <MaterialIcons name="headphones" size={80} color={theme.accent} />
          </View>
        )}
      </CardContent>
    </Card>
  );
});

const PlayerMetadataSection = React.memo(function PlayerMetadataSection() {
  const theme = useTheme();
  const titleText = usePlaybackStore((s) => s.currentBook?.title || 'No Audiobook Selected');
  const authorText = usePlaybackStore((s) => s.currentBook?.author || 'Unknown Author');

  return (
    <View style={styles.metadataContainer}>
      <Text variant="h1" weight="bold" numberOfLines={2} align="center" style={styles.bookTitleText}>
        {titleText}
      </Text>
      <Text variant="subhead" numberOfLines={1} align="center" color={theme.textSecondary} style={styles.authorText}>
        {authorText}
      </Text>
    </View>
  );
});

const PlayerSliderSection = React.memo(function PlayerSliderSection({
  onSeek,
}: {
  onSeek: (seconds: number) => void;
}) {
  const theme = useTheme();
  const position = usePlaybackStore((s) => s.position);
  const duration = usePlaybackStore((s) => s.duration);

  return (
    <View style={styles.sliderContainer}>
      <Slider
        value={position}
        minimumValue={0}
        maximumValue={duration > 0 ? duration : 100}
        onSlidingComplete={onSeek}
        formatTime={formatTime}
      />
      <View style={styles.timeLabelsRow}>
        <Text variant="caption" color={theme.textSecondary} style={styles.timeText}>
          {formatTime(position)}
        </Text>
        <Text variant="caption" color={theme.textSecondary} style={styles.timeText}>
          {formatRemainingTime(position, duration)}
        </Text>
      </View>
    </View>
  );
});

const PlayerControlsSection = React.memo(function PlayerControlsSection({
  onTogglePlayPause,
  onSkipBack,
  onSkipForward,
  onPrevChapter,
  onNextChapter,
  skipInterval,
}: {
  onTogglePlayPause: () => void;
  onSkipBack: () => void;
  onSkipForward: () => void;
  onPrevChapter: () => void;
  onNextChapter: () => void;
  skipInterval: number;
}) {
  const theme = useTheme();
  const isPlaying = usePlaybackStore((s) => s.isPlaying);

  return (
    <View style={styles.controlsRow}>
      {/* Prev Chapter Button */}
      <Button
        variant="ghost"
        size="icon"
        onPress={onPrevChapter}
        accessibilityLabel="Previous chapter"
        accessibilityRole="button"
        style={styles.chapterSkipButton}
      >
        <MaterialIcons name="skip-previous" size={28} color={theme.text} />
      </Button>

      {/* Skip Back Button */}
      <Button
        variant="secondary"
        size="icon"
        onPress={onSkipBack}
        accessibilityLabel={`Skip backward ${skipInterval} seconds`}
        accessibilityRole="button"
        style={styles.skipButton}
      >
        <View style={styles.skipInnerContainer}>
          {skipInterval === 10 ? (
            <MaterialIcons name="replay-10" size={24} color={theme.text} />
          ) : skipInterval === 30 ? (
            <MaterialIcons name="replay-30" size={24} color={theme.text} />
          ) : skipInterval === 5 ? (
            <MaterialIcons name="replay-5" size={24} color={theme.text} />
          ) : (
            <MaterialIcons name="replay" size={22} color={theme.text} />
          )}
        </View>
      </Button>

      {/* Play/Pause Hero Button (68x68 dp) */}
      <AnimatedPlayButton
        isPlaying={isPlaying}
        onPress={onTogglePlayPause}
        size={68}
        iconSize={40}
        accessibilityLabel={isPlaying ? 'Pause' : 'Play'}
      />

      {/* Skip Forward Button */}
      <Button
        variant="secondary"
        size="icon"
        onPress={onSkipForward}
        accessibilityLabel={`Skip forward ${skipInterval} seconds`}
        accessibilityRole="button"
        style={styles.skipButton}
      >
        <View style={styles.skipInnerContainer}>
          {skipInterval === 10 ? (
            <MaterialIcons name="forward-10" size={24} color={theme.text} />
          ) : skipInterval === 30 ? (
            <MaterialIcons name="forward-30" size={24} color={theme.text} />
          ) : skipInterval === 5 ? (
            <MaterialIcons name="forward-5" size={24} color={theme.text} />
          ) : (
            <MaterialIcons name="forward-10" size={24} color={theme.text} />
          )}
        </View>
      </Button>

      {/* Next Chapter Button */}
      <Button
        variant="ghost"
        size="icon"
        onPress={onNextChapter}
        accessibilityLabel="Next chapter"
        accessibilityRole="button"
        style={styles.chapterSkipButton}
      >
        <MaterialIcons name="skip-next" size={28} color={theme.text} />
      </Button>
    </View>
  );
});

const PlayerTogglesSection = React.memo(function PlayerTogglesSection({
  onOpenSpeedSheet,
  onOpenSleepSheet,
  onOpenChapterSheet,
  onOpenBookmarkSheet,
  onSpeedToggle,
  onSleepTimerToggle,
}: {
  onOpenSpeedSheet?: () => void;
  onOpenSleepSheet?: () => void;
  onOpenChapterSheet?: () => void;
  onOpenBookmarkSheet?: () => void;
  onSpeedToggle: () => void;
  onSleepTimerToggle: () => void;
}) {
  const theme = useTheme();
  const speed = usePlaybackStore((s) => s.speed);
  const sleepTimerType = usePlaybackStore((s) => s.sleepTimerType);
  const sleepTimerRemaining = usePlaybackStore((s) => s.sleepTimerRemaining);

  const formattedSleepText = useMemo(() => {
    if (!sleepTimerType) return 'Timer';
    if (sleepTimerType === 'chapter') return 'End Ch';
    if (sleepTimerRemaining && sleepTimerRemaining > 0) {
      const mins = Math.ceil(sleepTimerRemaining / 60);
      return `${mins}m`;
    }
    return 'Timer';
  }, [sleepTimerType, sleepTimerRemaining]);

  const handleSpeedPress = useCallback(() => {
    if (onOpenSpeedSheet) {
      onOpenSpeedSheet();
    } else {
      onSpeedToggle();
    }
  }, [onOpenSpeedSheet, onSpeedToggle]);

  const handleSleepPress = useCallback(() => {
    if (onOpenSleepSheet) {
      onOpenSleepSheet();
    } else {
      onSleepTimerToggle();
    }
  }, [onOpenSleepSheet, onSleepTimerToggle]);

  return (
    <View style={styles.togglesRow}>
      {/* Speed Toggle Chip */}
      <Toggle
        pressed={speed !== 1.0}
        onPressedChange={handleSpeedPress}
        accessibilityLabel={`Playback speed ${speed}x`}
        style={styles.toggleChip}
      >
        <MaterialIcons name="speed" size={18} color={speed !== 1.0 ? '#000000' : theme.text} />
        <Text
          variant="caption"
          weight="semiBold"
          style={{ color: speed !== 1.0 ? '#000000' : theme.text }}
        >
          {speed === 1.0 ? '1.0×' : `${speed}×`}
        </Text>
      </Toggle>

      {/* Sleep Timer Chip */}
      <Toggle
        pressed={Boolean(sleepTimerType)}
        onPressedChange={handleSleepPress}
        accessibilityLabel="Sleep timer"
        style={styles.toggleChip}
      >
        <MaterialIcons
          name="timer"
          size={18}
          color={sleepTimerType ? '#000000' : theme.text}
        />
        <Text
          variant="caption"
          weight="semiBold"
          style={{ color: sleepTimerType ? '#000000' : theme.text }}
        >
          {formattedSleepText}
        </Text>
      </Toggle>

      {/* Chapter Sheet Chip Button */}
      {onOpenChapterSheet && (
        <Button
          variant="ghost"
          size="sm"
          onPress={onOpenChapterSheet}
          accessibilityLabel="Chapters"
          accessibilityRole="button"
          style={styles.toggleButtonChip}
        >
          <MaterialIcons name="menu-book" size={18} color={theme.text} />
          <Text variant="caption" weight="semiBold" style={{ color: theme.text }}>
            Chapters
          </Text>
        </Button>
      )}

      {/* Bookmark Button */}
      {onOpenBookmarkSheet && (
        <Button
          variant="ghost"
          size="sm"
          onPress={onOpenBookmarkSheet}
          accessibilityLabel="Bookmarks"
          accessibilityRole="button"
          style={styles.toggleButtonChip}
        >
          <MaterialIcons name="bookmark-border" size={18} color={theme.text} />
          <Text variant="caption" weight="semiBold" style={{ color: theme.text }}>
            Bookmark
          </Text>
        </Button>
      )}
    </View>
  );
});

// ---------------------------------------------------------------------------
// Top-Level PlayerScreen Component
// ---------------------------------------------------------------------------

export function PlayerScreen({
  onClose,
  onOpenSpeedSheet,
  onOpenSleepSheet,
  onOpenChapterSheet,
  onOpenBookmarkSheet,
}: PlayerScreenProps) {
  const router = useRouter();
  const theme = useTheme();

  // Settings state from store
  const skipInterval = useSettingsStore((s) => s.skipInterval);

  // Stable Zustand actions
  const startSleepTimer = usePlaybackStore((s) => s.startSleepTimer);
  const clearSleepTimer = usePlaybackStore((s) => s.clearSleepTimer);

  // Optional Context hook
  let playerCtx: ReturnType<typeof usePlayerContext> | null = null;
  try {
    playerCtx = usePlayerContext();
  } catch {
    playerCtx = null;
  }

  const handleClose = useCallback(() => {
    if (onClose) {
      onClose();
    } else {
      safeGoBack(router);
    }
  }, [onClose, router]);

  const handleTogglePlayPause = useCallback(() => {
    if (playerCtx) {
      playerCtx.togglePlayPause();
    } else {
      const isPlaying = usePlaybackStore.getState().isPlaying;
      usePlaybackStore.getState().setIsPlaying(!isPlaying);
    }
  }, [playerCtx]);

  const handleSkipBack = useCallback(() => {
    if (playerCtx) {
      playerCtx.skipBackward(skipInterval);
    } else {
      const position = usePlaybackStore.getState().position;
      const newPos = Math.max(0, position - skipInterval);
      usePlaybackStore.getState().setPosition(newPos);
    }
  }, [playerCtx, skipInterval]);

  const handleSkipForward = useCallback(() => {
    if (playerCtx) {
      playerCtx.skipForward(skipInterval);
    } else {
      const { position, duration } = usePlaybackStore.getState();
      const newPos = Math.min(duration, position + skipInterval);
      usePlaybackStore.getState().setPosition(newPos);
    }
  }, [playerCtx, skipInterval]);

  const handlePrevChapter = useCallback(() => {
    if (playerCtx) {
      playerCtx.prevChapter();
    }
  }, [playerCtx]);

  const handleNextChapter = useCallback(() => {
    if (playerCtx) {
      playerCtx.nextChapter();
    }
  }, [playerCtx]);

  const handleSeek = useCallback(
    (newPosition: number) => {
      if (playerCtx) {
        playerCtx.seekTo(newPosition);
      } else {
        usePlaybackStore.getState().setPosition(newPosition);
      }
    },
    [playerCtx]
  );

  const handleSpeedToggle = useCallback(() => {
    const currentSpeed = usePlaybackStore.getState().speed;
    const currentIndex = SPEED_PRESETS.indexOf(currentSpeed);
    const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % SPEED_PRESETS.length : 0;
    const nextSpeed = SPEED_PRESETS[nextIndex];
    if (playerCtx) {
      playerCtx.setSpeed(nextSpeed);
    } else {
      usePlaybackStore.getState().setSpeed(nextSpeed);
    }
  }, [playerCtx]);

  const handleSleepTimerToggle = useCallback(() => {
    const sleepTimerType = usePlaybackStore.getState().sleepTimerType;
    if (sleepTimerType) {
      clearSleepTimer();
    } else {
      startSleepTimer(30 * 60, 'time');
    }
  }, [clearSleepTimer, startSleepTimer]);

  return (
    <PlayerPanGestureContainer onClose={handleClose}>
      <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
        <View style={styles.container}>
          {/* Top Header */}
          <PlayerHeaderSection onClose={handleClose} onOpenChapterSheet={onOpenChapterSheet} />

          {/* Main Scroll Content */}
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            {/* Elevated Cover Art Showcase */}
            <PlayerCoverArtSection />

            {/* Book & Chapter Metadata */}
            <PlayerMetadataSection />

            {/* Audio Scrubbing Slider & Time Formatting */}
            <PlayerSliderSection onSeek={handleSeek} />

            {/* Bottom Hero Control Bar */}
            <PlayerControlsSection
              onTogglePlayPause={handleTogglePlayPause}
              onSkipBack={handleSkipBack}
              onSkipForward={handleSkipForward}
              onPrevChapter={handlePrevChapter}
              onNextChapter={handleNextChapter}
              skipInterval={skipInterval}
            />

            {/* Toggles Toolbar (Playback Speed, Sleep Timer, Chapters & Bookmark) */}
            <PlayerTogglesSection
              onOpenSpeedSheet={onOpenSpeedSheet}
              onOpenSleepSheet={onOpenSleepSheet}
              onOpenChapterSheet={onOpenChapterSheet}
              onOpenBookmarkSheet={onOpenBookmarkSheet}
              onSpeedToggle={handleSpeedToggle}
              onSleepTimerToggle={handleSleepTimerToggle}
            />
          </ScrollView>
        </View>
      </SafeAreaView>
    </PlayerPanGestureContainer>
  );
}

export default PlayerScreen;

const screenWidth = Dimensions.get('window').width;
const coverSize = Math.min(screenWidth - 48, 320);

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 44,
    minHeight: 44,
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 8,
  },
  headerTitle: {
    fontSize: 16,
  },
  headerSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingBottom: 24,
    paddingTop: 8,
  },
  coverCard: {
    width: coverSize,
    height: coverSize,
    borderRadius: 24,
    padding: 0,
    overflow: 'hidden',
    alignSelf: 'center',
    marginVertical: 16,
  },
  coverCardContent: {
    width: '100%',
    height: '100%',
    padding: 0,
  },
  coverImage: {
    width: '100%',
    height: '100%',
    borderRadius: 24,
  },
  coverPlaceholder: {
    width: '100%',
    height: '100%',
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metadataContainer: {
    width: '100%',
    alignItems: 'center',
    marginVertical: 12,
  },
  bookTitleText: {
    fontSize: 22,
    lineHeight: 28,
  },
  authorText: {
    fontSize: 15,
    marginTop: 6,
  },
  sliderContainer: {
    width: '100%',
    marginVertical: 12,
  },
  timeLabelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: -4,
    paddingHorizontal: 2,
  },
  timeText: {
    fontSize: 12,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    marginVertical: 16,
    width: '100%',
  },
  chapterSkipButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 44,
    minHeight: 44,
  },
  skipButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 44,
    minHeight: 44,
  },
  skipInnerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroPlayButton: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
    minWidth: 68,
    minHeight: 68,
  },
  togglesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 12,
    width: '100%',
  },
  toggleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minWidth: 70,
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: 22,
  },
  toggleButtonChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 44,
    paddingHorizontal: 12,
    borderRadius: 22,
  },
});

