import React from 'react';
import { StyleSheet, View, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { MaterialIcons } from '@expo/vector-icons';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { Spacing } from '@/constants/theme';

interface ContinueListeningHeroProps {
  recentPlayback: {
    bookId: string;
    title: string;
    author: string | null;
    coverPath: string | null;
    duration: number;
    position: number;
  } | null;
  onPlayRecent: () => void;
}

export function ContinueListeningHero({ recentPlayback, onPlayRecent }: ContinueListeningHeroProps) {
  const theme = useTheme();

  if (!recentPlayback) return null;

  const progress = recentPlayback.duration > 0
    ? Math.min(1, recentPlayback.position / recentPlayback.duration)
    : 0;

  return (
    <View style={styles.container}>
      <ThemedText style={styles.sectionHeader}>Continue Listening</ThemedText>

      <Pressable
        onPress={onPlayRecent}
        style={({ pressed }) => [
          styles.heroCard,
          {
            backgroundColor: theme.backgroundElement,
            borderColor: theme.border,
            opacity: pressed ? 0.9 : 1,
          },
        ]}
      >
        <View style={styles.heroContent}>
          {recentPlayback.coverPath ? (
            <Image
              source={{ uri: recentPlayback.coverPath }}
              style={styles.heroCover}
              contentFit="cover"
            />
          ) : (
            <View style={[styles.fallbackCover, { backgroundColor: theme.backgroundSelected }]}>
              <MaterialIcons name="menu-book" size={32} color={theme.textSecondary} />
            </View>
          )}

          <View style={styles.heroInfo}>
            <ThemedText style={styles.heroTitle} numberOfLines={1}>
              {recentPlayback.title}
            </ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.heroAuthor} numberOfLines={1}>
              {recentPlayback.author || 'Unknown Author'}
            </ThemedText>

            {/* Progress bar */}
            <View style={[styles.progressTrack, { backgroundColor: theme.backgroundSelected }]}>
              <View
                style={[
                  styles.progressFill,
                  { backgroundColor: theme.accent, width: `${progress * 100}%` },
                ]}
              />
            </View>
          </View>

          <View style={[styles.playCircle, { backgroundColor: theme.accent }]}>
            <MaterialIcons name="play-arrow" size={28} color="#000" />
          </View>
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: Spacing.four,
    marginBottom: Spacing.four,
  },
  sectionHeader: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  heroCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
  },
  heroContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroCover: {
    width: 64,
    height: 64,
    borderRadius: 14,
  },
  fallbackCover: {
    width: 64,
    height: 64,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroInfo: {
    flex: 1,
    marginHorizontal: 14,
  },
  heroTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  heroAuthor: {
    fontSize: 13,
    marginTop: 2,
    marginBottom: 10,
  },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  playCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
