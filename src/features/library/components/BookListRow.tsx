import React from 'react';
import { StyleSheet, View, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { MaterialIcons } from '@expo/vector-icons';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { AudiobookRecord, PlaybackRecord } from '@/database/types';
import { Spacing } from '@/constants/theme';

interface BookListRowProps {
  book: AudiobookRecord;
  playback?: PlaybackRecord;
  onPress: () => void;
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function BookListRow({ book, playback, onPress }: BookListRowProps) {
  const theme = useTheme();

  const progress = playback && book.duration > 0
    ? Math.min(1, playback.position / book.duration)
    : 0;

  const isCompleted = playback?.completed === 1 || progress >= 0.99;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.rowContainer,
        {
          backgroundColor: theme.backgroundElement,
          borderColor: theme.border,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <View style={styles.thumbnailContainer}>
        {book.coverPath ? (
          <Image source={{ uri: book.coverPath }} style={styles.thumbnail} contentFit="cover" />
        ) : (
          <View style={[styles.fallbackThumbnail, { backgroundColor: theme.backgroundSelected }]}>
            <MaterialIcons name="menu-book" size={24} color={theme.textSecondary} />
          </View>
        )}
      </View>

      <View style={styles.infoContainer}>
        <ThemedText style={styles.title} numberOfLines={1}>
          {book.title}
        </ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.author} numberOfLines={1}>
          {book.author || 'Unknown Author'}
        </ThemedText>

        <View style={styles.metaRow}>
          <ThemedText themeColor="textSecondary" style={styles.metaText}>
            {formatDuration(book.duration)}
          </ThemedText>
          {isCompleted ? (
            <View style={styles.completedTag}>
              <MaterialIcons name="check-circle" size={14} color="#30D158" />
              <ThemedText style={styles.completedText}>Completed</ThemedText>
            </View>
          ) : progress > 0 ? (
            <ThemedText style={[styles.metaText, { color: theme.accent }]}>
              {Math.round(progress * 100)}% listened
            </ThemedText>
          ) : null}
        </View>
      </View>

      <MaterialIcons name="chevron-right" size={24} color={theme.textSecondary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  rowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 10,
  },
  thumbnailContainer: {
    width: 52,
    height: 52,
    borderRadius: 12,
    overflow: 'hidden',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  fallbackThumbnail: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoContainer: {
    flex: 1,
    marginHorizontal: 12,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
  },
  author: {
    fontSize: 12,
    marginTop: 2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
  },
  metaText: {
    fontSize: 12,
    fontWeight: '600',
  },
  completedTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  completedText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#30D158',
  },
});
