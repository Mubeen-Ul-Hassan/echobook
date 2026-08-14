import React, { useEffect } from 'react';
import { StyleSheet, View, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/use-theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const COVER_SIZE = Math.min(SCREEN_WIDTH * 0.75, 320);

interface PlayerCoverArtProps {
  coverPath?: string | null;
  title: string;
  isPlaying?: boolean;
}

export function PlayerCoverArt({ coverPath, title, isPlaying = false }: PlayerCoverArtProps) {
  const theme = useTheme();

  // Subtle spring scale animation response to playback state
  const playingScale = useSharedValue(isPlaying ? 1.0 : 0.96);

  useEffect(() => {
    playingScale.value = withSpring(isPlaying ? 1.0 : 0.96, {
      damping: 15,
      stiffness: 150,
      mass: 0.8,
    });
  }, [isPlaying, playingScale]);

  const animatedCoverStyle = useAnimatedStyle(() => ({
    transform: [{ scale: playingScale.value }],
  }));

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.shadowBox,
          { shadowColor: '#000000' },
          animatedCoverStyle,
        ]}
      >
        <View style={styles.imageClipContainer}>
          {coverPath ? (
            <Image
              source={{ uri: coverPath }}
              style={styles.coverImage}
              contentFit="cover"
              transition={400}
              cachePolicy="disk"
              accessibilityLabel={`Cover art for ${title}`}
            />
          ) : (
            <View style={[styles.fallbackBox, { backgroundColor: theme.backgroundElement }]}>
              <MaterialIcons name="headphones" size={80} color={theme.accent} />
            </View>
          )}
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 16,
  },
  shadowBox: {
    width: COVER_SIZE,
    height: COVER_SIZE,
    borderRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.3,
    shadowRadius: 18,
    elevation: 12,
    backgroundColor: '#000000',
  },
  imageClipContainer: {
    width: '100%',
    height: '100%',
    borderRadius: 24,
    overflow: 'hidden',
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

