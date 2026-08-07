/**
 * MiniPlayer
 *
 * A sleek floating playback bar displayed on non-player screens.
 * Positioned dynamically above the bottom safe area (navigation bar)
 * to ensure clear visibility on Android 15 (Samsung S22 Ultra) and iOS devices.
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
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
import { Spacing } from '@/constants/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export function MiniPlayer() {
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { play, pause, skipForward } = usePlayerContext();

  const currentBook = usePlaybackStore((s) => s.currentBook);
  const currentChapter = usePlaybackStore((s) => s.currentChapter);
  const isPlaying = usePlaybackStore((s) => s.isPlaying);
  const position = usePlaybackStore((s) => s.position);
  const isPlayerVisible = usePlaybackStore((s) => s.isPlayerVisible);
  const resetPlayback = usePlaybackStore((s) => s.resetPlayback);

  // Calculate safe bottom padding above gesture bar
  const bottomPosition = Math.max(insets.bottom, 12) + Spacing.two;

  // Smooth progress bar calculation based on current chapter duration
  const getProgressRatio = () => {
    if (currentChapter && currentChapter.endTime > currentChapter.startTime) {
      const chapterDuration = currentChapter.endTime - currentChapter.startTime;
      const chapterPosition = position - currentChapter.startTime;
      return Math.min(1, Math.max(0, chapterPosition / chapterDuration));
    }
    if (currentBook && currentBook.duration > 0) {
      return Math.min(1, Math.max(0, position / currentBook.duration));
    }
    return 0;
  };

  const progressRatio = getProgressRatio();

  const progressSV = useSharedValue(progressRatio);
  React.useEffect(() => {
    progressSV.value = withTiming(progressRatio, { duration: 400, easing: Easing.linear });
  }, [progressRatio, progressSV]);

  const progressStyle = useAnimatedStyle(() => ({
    width: `${Math.min(100, Math.max(0, progressSV.value * 100))}%`,
  }));

  if (!currentBook || isPlayerVisible) return null;

  return (
    <Animated.View
      entering={FadeInDown.springify().damping(20).stiffness(160)}
      exiting={FadeOutDown.duration(180)}
      style={[
        styles.container,
        {
          backgroundColor: theme.backgroundElement,
          borderColor: theme.border,
          bottom: bottomPosition,
        },
      ]}
    >
      {/* Top progress indicator strip */}
      <View style={[styles.progressTrack, { backgroundColor: theme.backgroundSelected }]}>
        <Animated.View style={[styles.progressFill, { backgroundColor: theme.accent }, progressStyle]} />
      </View>

      {/* Main body card */}
      <Pressable
        onPress={() => router.push('/player')}
        style={styles.body}
        accessibilityRole="button"
        accessibilityLabel={`Now playing: ${currentChapter?.title ?? currentBook.title}. Tap to open full player.`}
      >
        {/* Cover Artwork */}
        {currentBook.coverPath ? (
          <Image
            source={{ uri: currentBook.coverPath }}
            style={styles.cover}
            contentFit="cover"
          />
        ) : (
          <View style={[styles.cover, { backgroundColor: theme.backgroundSelected }]}>
            <MaterialIcons name="graphic-eq" size={22} color={theme.accent} />
          </View>
        )}

        {/* Book & Chapter Details */}
        <View style={styles.info}>
          <ThemedText numberOfLines={1} style={styles.chapterText}>
            {currentChapter?.title ?? currentBook.title}
          </ThemedText>
          <ThemedText numberOfLines={1} type="small" themeColor="textSecondary" style={styles.bookText}>
            {currentBook.title}
            {currentBook.author ? ` · ${currentBook.author}` : ''}
          </ThemedText>
        </View>

        {/* Playback Controls */}
        <View style={styles.controlsRow}>
          {/* Skip Forward 30s */}
          <Pressable
            onPress={() => skipForward(30)}
            hitSlop={8}
            style={({ pressed }) => [styles.iconBtn, { opacity: pressed ? 0.6 : 1 }]}
            accessibilityRole="button"
            accessibilityLabel="Skip forward 30 seconds"
          >
            <MaterialIcons name="forward-30" size={24} color={theme.text} />
          </Pressable>

          {/* Play / Pause Toggle */}
          <Pressable
            onPress={isPlaying ? pause : play}
            hitSlop={8}
            style={({ pressed }) => [
              styles.playBtn,
              { backgroundColor: theme.accent, opacity: pressed ? 0.85 : 1 },
            ]}
            accessibilityRole="button"
            accessibilityLabel={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? (
              <MaterialIcons name="pause" size={22} color="#000000" />
            ) : (
              <MaterialIcons name="play-arrow" size={22} color="#000000" />
            )}
          </Pressable>

          {/* Dismiss */}
          <Pressable
            onPress={resetPlayback}
            hitSlop={8}
            style={({ pressed }) => [styles.iconBtn, { opacity: pressed ? 0.5 : 1 }]}
            accessibilityRole="button"
            accessibilityLabel="Close mini player"
          >
            <MaterialIcons name="close" size={20} color={theme.textSecondary} />
          </Pressable>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: Spacing.three,
    right: Spacing.three,
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 18,
    elevation: 16,
    zIndex: 999,
  },
  progressTrack: {
    height: 3,
    width: '100%',
  },
  progressFill: {
    height: '100%',
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
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  info: {
    flex: 1,
    justifyContent: 'center',
  },
  chapterText: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.1,
  },
  bookText: {
    fontSize: 12,
    marginTop: 1,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#F7991C',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 4,
  },
});
