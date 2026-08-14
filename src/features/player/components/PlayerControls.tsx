import React, { useEffect } from 'react';
import { StyleSheet, View, Pressable, ActivityIndicator } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
} from 'react-native-reanimated';
import { MaterialIcons } from '@expo/vector-icons';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

import { AnimatedPlayButton } from '@/features/player/components/AnimatedPlayButton';

interface PlayerControlsProps {
  isPlaying: boolean;
  isLoaded: boolean;
  speed: number;
  hasSleepTimer: boolean;
  sleepTimerRemainingText?: string;
  bookmarkCount?: number;
  onTogglePlayPause: () => void;
  onSkipBack: () => void;
  onSkipForward: () => void;
  onPrevChapter: () => void;
  onNextChapter: () => void;
  onOpenSpeedSheet: () => void;
  onOpenSleepSheet: () => void;
  onOpenChapterSheet: () => void;
  onOpenBookmarkSheet: () => void;
}

export function PlayerControls({
  isPlaying,
  isLoaded,
  speed,
  hasSleepTimer,
  sleepTimerRemainingText,
  bookmarkCount = 0,
  onTogglePlayPause,
  onSkipBack,
  onSkipForward,
  onPrevChapter,
  onNextChapter,
  onOpenSpeedSheet,
  onOpenSleepSheet,
  onOpenChapterSheet,
  onOpenBookmarkSheet,
}: PlayerControlsProps) {
  const theme = useTheme();

  return (
    <View style={styles.container}>
      {/* Primary Playback Controls Row */}
      <View style={styles.mainRow}>
        <Pressable
          onPress={onPrevChapter}
          style={({ pressed }) => [styles.smallBtn, { opacity: pressed ? 0.7 : 1 }]}
          accessibilityRole="button"
          accessibilityLabel="Previous chapter"
        >
          <MaterialIcons name="skip-previous" size={28} color={theme.text} />
        </Pressable>

        <Pressable
          onPress={onSkipBack}
          style={({ pressed }) => [styles.medBtn, { opacity: pressed ? 0.7 : 1 }]}
          accessibilityRole="button"
          accessibilityLabel="Rewind 30 seconds"
        >
          <MaterialIcons name="replay-30" size={32} color={theme.text} />
        </Pressable>

        <AnimatedPlayButton
          isPlaying={isPlaying}
          isLoading={!isLoaded}
          onPress={onTogglePlayPause}
          size={72}
          iconSize={40}
        />

        <Pressable
          onPress={onSkipForward}
          style={({ pressed }) => [styles.medBtn, { opacity: pressed ? 0.7 : 1 }]}
          accessibilityRole="button"
          accessibilityLabel="Forward 30 seconds"
        >
          <MaterialIcons name="forward-30" size={32} color={theme.text} />
        </Pressable>

        <Pressable
          onPress={onNextChapter}
          style={({ pressed }) => [styles.smallBtn, { opacity: pressed ? 0.7 : 1 }]}
          accessibilityRole="button"
          accessibilityLabel="Next chapter"
        >
          <MaterialIcons name="skip-next" size={28} color={theme.text} />
        </Pressable>
      </View>

      {/* Secondary Bottom Toolbar Row (Speed, Sleep Timer, Chapters, Bookmarks) */}
      <View style={styles.toolRow}>
        <Pressable
          onPress={onOpenSpeedSheet}
          style={({ pressed }) => [
            styles.toolChip,
            { backgroundColor: theme.backgroundElement, opacity: pressed ? 0.8 : 1 },
          ]}
          accessibilityRole="button"
          accessibilityLabel={`Speed ${speed}x`}
        >
          <ThemedText style={styles.toolChipText}>{speed === 1.0 ? '1.0×' : `${speed}×`}</ThemedText>
        </Pressable>

        <Pressable
          onPress={onOpenSleepSheet}
          style={({ pressed }) => [
            styles.toolChip,
            {
              backgroundColor: hasSleepTimer ? theme.accent : theme.backgroundElement,
              opacity: pressed ? 0.8 : 1,
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Sleep timer"
        >
          <MaterialIcons
            name="timer"
            size={18}
            color={hasSleepTimer ? '#000' : theme.text}
          />
          {sleepTimerRemainingText ? (
            <ThemedText style={[styles.toolChipText, { color: '#000', marginLeft: 4 }]}>
              {sleepTimerRemainingText}
            </ThemedText>
          ) : null}
        </Pressable>

        <Pressable
          onPress={onOpenChapterSheet}
          style={({ pressed }) => [
            styles.toolChip,
            { backgroundColor: theme.backgroundElement, opacity: pressed ? 0.8 : 1 },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Chapters list"
        >
          <MaterialIcons name="format-list-bulleted" size={18} color={theme.text} />
          <ThemedText style={[styles.toolChipText, { marginLeft: 4 }]}>Chapters</ThemedText>
        </Pressable>

        <Pressable
          onPress={onOpenBookmarkSheet}
          style={({ pressed }) => [
            styles.toolChip,
            { backgroundColor: theme.backgroundElement, opacity: pressed ? 0.8 : 1 },
          ]}
          accessibilityRole="button"
          accessibilityLabel={`Bookmarks (${bookmarkCount})`}
        >
          <MaterialIcons name="bookmark-border" size={18} color={theme.text} />
          <ThemedText style={[styles.toolChipText, { marginLeft: 4 }]}>
            Bookmarks{bookmarkCount > 0 ? ` (${bookmarkCount})` : ''}
          </ThemedText>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 16,
    alignItems: 'center',
  },
  mainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
  },
  smallBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  medBtn: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 6,
  },
  toolRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 28,
    paddingHorizontal: 8,
  },
  toolChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 18,
  },
  toolChipText: {
    fontSize: 12,
    fontWeight: '700',
  },
});

