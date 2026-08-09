import React, { useState, useCallback } from 'react';
import { StyleSheet, View, Pressable, Dimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, runOnJS } from 'react-native-reanimated';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { Spacing } from '@/constants/theme';
import { ChapterRecord } from '@/database/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SEEK_BAR_WIDTH = SCREEN_WIDTH - Spacing.four * 2;

interface PlayerSeekBarProps {
  position: number;
  duration: number;
  currentChapter?: ChapterRecord | null;
  onSeek: (seconds: number) => Promise<void>;
}

function formatTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  if (h > 0) return `${h}:${pad(m)}:${pad(sec)}`;
  return `${m}:${pad(sec)}`;
}

export function PlayerSeekBar({ position, duration, currentChapter, onSeek }: PlayerSeekBarProps) {
  const theme = useTheme();
  const [showRemaining, setShowRemaining] = useState(false);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [scrubPosition, setScrubPosition] = useState(0);

  // Chapter-aware boundaries
  const chapterStartTime =
    currentChapter && currentChapter.endTime > currentChapter.startTime ? currentChapter.startTime : 0;
  const chapterEndTime =
    currentChapter && currentChapter.endTime > currentChapter.startTime ? currentChapter.endTime : duration;
  const activeDuration = Math.max(1, chapterEndTime - chapterStartTime);

  // Current position relative to active chapter start (starts at 0:00 for each chapter)
  const activePosition = Math.min(activeDuration, Math.max(0, position - chapterStartTime));

  const progressRatio = activeDuration > 0 ? Math.min(1, Math.max(0, activePosition / activeDuration)) : 0;
  const displayPosition = isScrubbing ? scrubPosition : activePosition;

  const handleSeekCommit = useCallback(
    (targetChapterSeconds: number) => {
      setIsScrubbing(false);
      const absoluteTarget = chapterStartTime + targetChapterSeconds;
      onSeek(absoluteTarget);
    },
    [onSeek, chapterStartTime]
  );

  const panGesture = Gesture.Pan()
    .onBegin((event) => {
      'worklet';
      const ratio = Math.max(0, Math.min(1, event.x / SEEK_BAR_WIDTH));
      const targetSec = ratio * activeDuration;
      runOnJS(setIsScrubbing)(true);
      runOnJS(setScrubPosition)(targetSec);
    })
    .onUpdate((event) => {
      'worklet';
      const ratio = Math.max(0, Math.min(1, event.x / SEEK_BAR_WIDTH));
      const targetSec = ratio * activeDuration;
      runOnJS(setScrubPosition)(targetSec);
    })
    .onEnd((event) => {
      'worklet';
      const ratio = Math.max(0, Math.min(1, event.x / SEEK_BAR_WIDTH));
      const targetSec = ratio * activeDuration;
      runOnJS(handleSeekCommit)(targetSec);
    });

  const remainingSeconds = Math.max(0, activeDuration - displayPosition);

  return (
    <View style={styles.container}>
      <GestureDetector gesture={panGesture}>
        <View style={styles.trackContainer}>
          <View style={[styles.trackBackground, { backgroundColor: theme.backgroundElement }]}>
            <View
              style={[
                styles.trackFill,
                {
                  backgroundColor: theme.accent,
                  width: `${(isScrubbing ? (activeDuration > 0 ? scrubPosition / activeDuration : 0) : progressRatio) * 100}%`,
                },
              ]}
            />
          </View>
        </View>
      </GestureDetector>

      <View style={styles.timeRow}>
        <ThemedText themeColor="textSecondary" style={styles.timeText}>
          {formatTime(displayPosition)}
        </ThemedText>
        <Pressable onPress={() => setShowRemaining((prev) => !prev)}>
          <ThemedText themeColor="textSecondary" style={styles.timeText}>
            {showRemaining ? `-${formatTime(remainingSeconds)}` : formatTime(activeDuration)}
          </ThemedText>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: Spacing.four,
    marginVertical: 12,
  },
  trackContainer: {
    height: 32,
    justifyContent: 'center',
  },
  trackBackground: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    width: SEEK_BAR_WIDTH,
  },
  trackFill: {
    height: '100%',
    borderRadius: 3,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  timeText: {
    fontSize: 12,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
});
