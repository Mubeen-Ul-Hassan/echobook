/**
 * MiniPlayer
 *
 * A sleek floating playback bar displayed on non-player screens.
 * Positioned dynamically above the bottom navigation bar with a thin line distinction.
 */
import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { usePathname, useRouter } from 'expo-router';
import {
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { usePlayerContext } from '@/features/player/components/playback-provider';
import { usePlaybackStore } from '@/hooks/use-playback-store';
import { useTheme } from '@/hooks/use-theme';
import { navigateToPlayer } from '@/utils/navigation';

function formatRemainingTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;

  if (hrs > 0) {
    return `${hrs}h ${mins}min left`;
  }
  if (mins > 0) {
    return `${mins}min ${secs}s left`;
  }
  return `${secs}s left`;
}

export function MiniPlayer() {
  const router = useRouter();
  const pathname = usePathname();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { play, pause, skipBackward } = usePlayerContext();

  const currentBook = usePlaybackStore((s) => s.currentBook);
  const currentChapter = usePlaybackStore((s) => s.currentChapter);
  const position = usePlaybackStore((s) => s.position);
  const duration = usePlaybackStore((s) => s.duration);
  const isPlaying = usePlaybackStore((s) => s.isPlaying);
  const isPlayerVisible = usePlaybackStore((s) => s.isPlayerVisible);

  const chapterStartTime =
    currentChapter && currentChapter.endTime > currentChapter.startTime ? currentChapter.startTime : 0;
  const chapterEndTime =
    currentChapter && currentChapter.endTime > currentChapter.startTime ? currentChapter.endTime : duration;
  const activeDuration = Math.max(1, chapterEndTime - chapterStartTime);

  const activePosition = Math.min(activeDuration, Math.max(0, position - chapterStartTime));
  const remainingSeconds = Math.max(0, activeDuration - activePosition);

  // Check if current screen has bottom navigation tab bar
  const isTabScreen =
    pathname === '/' ||
    pathname === '/index' ||
    pathname === '/library' ||
    pathname === '/profile' ||
    pathname.startsWith('/book') ||
    pathname.startsWith('/(tabs)');

  // Height of bottom tab bar content (64) + safe area inset
  const tabBarHeight = 64 + Math.max(insets.bottom, 8);

  // Position mini-player directly attached to top of bottom navigation bar on tab screens, or at bottom inset on non-tab screens
  const bottomPosition = isTabScreen
    ? tabBarHeight
    : Math.max(insets.bottom, 0);

  const isPlayerScreen = pathname === '/player';

  if (!currentBook || isPlayerVisible || isPlayerScreen) return null;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.backgroundElement,
          borderTopColor: theme.border,
          borderBottomColor: theme.border,
          bottom: bottomPosition,
        },
      ]}
    >
      {/* Main body card */}
      <Pressable
        onPress={() => navigateToPlayer(router, pathname)}
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

        {/* Chapter Details & Remaining Time */}
        <View style={styles.info}>
          <ThemedText numberOfLines={1} style={styles.chapterText}>
            {currentChapter?.title ?? currentBook.title}
          </ThemedText>
          <ThemedText numberOfLines={1} type="small" themeColor="textSecondary" style={styles.bookText}>
            {formatRemainingTime(remainingSeconds)}
          </ThemedText>
        </View>

        {/* Playback Controls: Fast Backward & Play/Pause (Identical proportions & size) */}
        <View style={styles.controlsRow}>
          {/* Fast Backward (30s) */}
          <Pressable
            onPress={() => skipBackward(30)}
            hitSlop={8}
            style={({ pressed }) => [
              styles.controlBtn,
              { backgroundColor: theme.backgroundSelected, opacity: pressed ? 0.8 : 1 },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Fast backward 30 seconds"
          >
            <MaterialIcons name="replay-30" size={35} color={theme.text} />
          </Pressable>

          {/* Play / Pause Toggle */}
          <Pressable
            onPress={isPlaying ? pause : play}
            hitSlop={8}
            style={({ pressed }) => [
              styles.controlBtn,
              { backgroundColor: theme.accent, opacity: pressed ? 0.85 : 1 },
            ]}
            accessibilityRole="button"
            accessibilityLabel={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? (
              <MaterialIcons name="pause" size={35} color="#000000" />
            ) : (
              <MaterialIcons name="play-arrow" size={35} color="#000000" />
            )}
          </Pressable>
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderRadius: 0,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderLeftWidth: 0,
    borderRightWidth: 0,
    overflow: 'hidden',
    zIndex: 999,
  },
  body: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 64,
    paddingHorizontal: Spacing.three,
    gap: Spacing.two + 2,
  },
  cover: {
    width: 44,
    height: 44,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
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
  controlBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
