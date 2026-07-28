/**
 * MiniPlayer
 *
 * A slim playback bar that floats above the tab bar on every non-player screen.
 * It is visible when:
 *   • A book is loaded (currentBook !== null)
 *   • The full player screen is NOT open (isPlayerVisible === false)
 *
 * Tapping the bar opens the full player. The play/pause button toggles playback
 * without leaving the current screen.
 */
import React from 'react';
import {
  Dimensions,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { Play, Pause, Music, X } from 'lucide-react-native';
import Animated, {
  FadeInDown,
  FadeOutDown,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  Easing,
} from 'react-native-reanimated';

import { usePlaybackStore } from '@/hooks/use-playback-store';
import { usePlayerContext } from '@/features/player/components/playback-provider';
import { useTheme } from '@/hooks/use-theme';
import { ThemedText } from '@/components/themed-text';
import { Spacing, BottomTabInset } from '@/constants/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export function MiniPlayer() {
  const router = useRouter();
  const theme = useTheme();
  const { play, pause } = usePlayerContext();

  const currentBook = usePlaybackStore((s) => s.currentBook);
  const currentChapter = usePlaybackStore((s) => s.currentChapter);
  const isPlaying = usePlaybackStore((s) => s.isPlaying);
  const position = usePlaybackStore((s) => s.position);
  const isPlayerVisible = usePlaybackStore((s) => s.isPlayerVisible);
  const resetPlayback = usePlaybackStore((s) => s.resetPlayback);

  // Progress bar animation using shared value
  const progressRatio =
    currentBook && currentBook.duration > 0
      ? Math.min(1, position / currentBook.duration)
      : 0;

  const progressSV = useSharedValue(progressRatio);
  React.useEffect(() => {
    progressSV.value = withTiming(progressRatio, { duration: 600, easing: Easing.linear });
  }, [progressRatio, progressSV]);

  const progressStyle = useAnimatedStyle(() => ({
    width: progressSV.value * (SCREEN_WIDTH - Spacing.three * 2 - 4),
  }));

  if (!currentBook || isPlayerVisible) return null;

  return (
    <Animated.View
      entering={FadeInDown.springify().damping(16).stiffness(120)}
      exiting={FadeOutDown.duration(200)}
      style={[
        styles.container,
        {
          backgroundColor: theme.backgroundElement,
          bottom: BottomTabInset + Spacing.two,
        },
      ]}
    >
      {/* Tap bar body → open full player */}
      <Pressable
        onPress={() => router.push('/player')}
        style={styles.body}
        accessibilityRole="button"
        accessibilityLabel={`Now playing: ${currentChapter?.title ?? currentBook.title}. Tap to open player.`}
      >
        {/* Cover thumbnail */}
        {currentBook.coverPath ? (
          <Image
            source={{ uri: currentBook.coverPath }}
            style={styles.cover}
            contentFit="cover"
          />
        ) : (
          <View style={[styles.cover, { backgroundColor: theme.backgroundSelected }]}>
            <Music size={18} color={theme.textSecondary} />
          </View>
        )}

        {/* Title + chapter */}
        <View style={styles.info}>
          <ThemedText numberOfLines={1} style={styles.chapterText}>
            {currentChapter?.title ?? currentBook.title}
          </ThemedText>
          <ThemedText numberOfLines={1} type="small" themeColor="textSecondary">
            {currentBook.title}
            {currentBook.author ? ` · ${currentBook.author}` : ''}
          </ThemedText>
        </View>

        {/* Play / Pause */}
        <Pressable
          onPress={isPlaying ? pause : play}
          hitSlop={12}
          style={({ pressed }) => [styles.playBtn, { opacity: pressed ? 0.6 : 1 }]}
          accessibilityRole="button"
          accessibilityLabel={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? (
            <Pause size={22} color={theme.accent} fill={theme.accent} />
          ) : (
            <Play size={22} color={theme.accent} fill={theme.accent} style={{ marginLeft: 2 }} />
          )}
        </Pressable>

        {/* Dismiss */}
        <Pressable
          onPress={resetPlayback}
          hitSlop={12}
          style={({ pressed }) => [styles.closeBtn, { opacity: pressed ? 0.6 : 1 }]}
          accessibilityRole="button"
          accessibilityLabel="Stop and dismiss player"
        >
          <X size={16} color={theme.textSecondary} />
        </Pressable>
      </Pressable>

      {/* Progress strip */}
      <View style={[styles.progressTrack, { backgroundColor: theme.backgroundSelected }]}>
        <Animated.View style={[styles.progressFill, { backgroundColor: theme.accent }, progressStyle]} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: Spacing.three,
    right: Spacing.three,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 12,
    zIndex: 100,
  },
  body: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.two + 4,
    paddingVertical: Spacing.two,
    gap: Spacing.two,
  },
  cover: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: { flex: 1 },
  chapterText: { fontSize: 14, fontWeight: '600' },
  playBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtn: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressTrack: {
    height: 2,
    marginHorizontal: 4,
  },
  progressFill: {
    height: '100%',
    borderRadius: 1,
  },
});
