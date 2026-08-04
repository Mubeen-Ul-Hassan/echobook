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
      entering={FadeInDown.springify().damping(18).stiffness(140)}
      exiting={FadeOutDown.duration(200)}
      style={[
        styles.container,
        {
          backgroundColor: theme.backgroundElement,
          borderColor: theme.border,
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
            <Music size={18} color={theme.accent} />
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

        {/* Controls Container */}
        <View style={styles.controlsRow}>
          {/* Play / Pause */}
          <Pressable
            onPress={isPlaying ? pause : play}
            hitSlop={12}
            style={({ pressed }) => [
              styles.playBtn,
              { backgroundColor: theme.accent, opacity: pressed ? 0.8 : 1 },
            ]}
            accessibilityRole="button"
            accessibilityLabel={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? (
              <Pause size={18} color="#000000" fill="#000000" />
            ) : (
              <Play size={18} color="#000000" fill="#000000" style={{ marginLeft: 2 }} />
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
        </View>
      </Pressable>

      {/* Audible Progress strip */}
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
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 14,
    zIndex: 100,
  },
  body: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.two + 4,
    paddingVertical: Spacing.two + 2,
    gap: Spacing.two + 2,
  },
  cover: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  info: { flex: 1, justifyContent: 'center' },
  chapterText: { fontSize: 14, fontWeight: '700', letterSpacing: -0.1 },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  playBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#F7991C',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  closeBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressTrack: {
    height: 3,
    width: '100%',
  },
  progressFill: {
    height: '100%',
    borderRadius: 1.5,
  },
});
