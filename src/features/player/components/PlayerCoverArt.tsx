import React from 'react';
import { StyleSheet, View, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/use-theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const COVER_SIZE = SCREEN_WIDTH * 0.72;

interface PlayerCoverArtProps {
  coverPath?: string | null;
  title: string;
  isPlaying?: boolean;
}

export function PlayerCoverArt({ coverPath, title, isPlaying }: PlayerCoverArtProps) {
  const theme = useTheme();

  return (
    <View style={styles.container}>
      <View style={[styles.shadowBox, { shadowColor: theme.accent }]}>
        {coverPath ? (
          <Image
            source={{ uri: coverPath }}
            style={styles.coverImage}
            contentFit="cover"
            transition={300}
            accessibilityLabel={`Cover art for ${title}`}
          />
        ) : (
          <View style={[styles.fallbackBox, { backgroundColor: theme.backgroundElement }]}>
            <MaterialIcons name="menu-book" size={72} color={theme.textSecondary} />
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 24,
  },
  shadowBox: {
    width: COVER_SIZE,
    height: COVER_SIZE,
    borderRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 12,
  },
  coverImage: {
    width: '100%',
    height: '100%',
    borderRadius: 24,
  },
  fallbackBox: {
    width: '100%',
    height: '100%',
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
