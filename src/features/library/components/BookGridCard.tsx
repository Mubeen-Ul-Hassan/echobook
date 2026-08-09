import React from 'react';
import { StyleSheet, View, Pressable, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { MaterialIcons } from '@expo/vector-icons';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { AudiobookRecord, PlaybackRecord } from '@/database/types';
import { Spacing } from '@/constants/theme';

const { width } = Dimensions.get('window');
const COLUMN_WIDTH = (width - Spacing.four * 2 - Spacing.three) / 2;

interface BookGridCardProps {
  book: AudiobookRecord;
  playback?: PlaybackRecord;
  onPress: () => void;
}

export function BookGridCard({ book, playback, onPress }: BookGridCardProps) {
  const theme = useTheme();

  const progress = playback && book.duration > 0
    ? Math.min(1, playback.position / book.duration)
    : 0;

  const isCompleted = playback?.completed === 1 || progress >= 0.99;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        { opacity: pressed ? 0.85 : 1 },
      ]}
    >
      <View style={[styles.coverContainer, { backgroundColor: theme.backgroundElement }]}>
        {book.coverPath ? (
          <Image
            source={{ uri: book.coverPath }}
            style={styles.coverImage}
            contentFit="cover"
            transition={200}
          />
        ) : (
          <View style={styles.fallbackCover}>
            <MaterialIcons name="menu-book" size={40} color={theme.textSecondary} />
          </View>
        )}

        {isCompleted && (
          <View style={[styles.completedBadge, { backgroundColor: '#30D158' }]}>
            <MaterialIcons name="check" size={14} color="#000" />
          </View>
        )}

        {/* Progress bar overlay at bottom of cover */}
        {progress > 0 && !isCompleted && (
          <View style={styles.progressOverlayTrack}>
            <View style={[styles.progressOverlayFill, { backgroundColor: theme.accent, width: `${progress * 100}%` }]} />
          </View>
        )}
      </View>

      <ThemedText style={styles.title} numberOfLines={1}>
        {book.title}
      </ThemedText>
      <ThemedText themeColor="textSecondary" style={styles.author} numberOfLines={1}>
        {book.author || 'Unknown Author'}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: COLUMN_WIDTH,
    marginBottom: 20,
  },
  coverContainer: {
    width: COLUMN_WIDTH,
    height: COLUMN_WIDTH,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 8,
    position: 'relative',
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  fallbackCover: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  completedBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressOverlayTrack: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  progressOverlayFill: {
    height: '100%',
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
  },
  author: {
    fontSize: 12,
    marginTop: 2,
  },
});
