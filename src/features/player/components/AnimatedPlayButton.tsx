import React, { useEffect } from 'react';
import { StyleSheet, Pressable, View, ActivityIndicator, StyleProp, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  interpolate,
} from 'react-native-reanimated';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/use-theme';

export interface AnimatedPlayButtonProps {
  isPlaying: boolean;
  isLoading?: boolean;
  onPress: () => void;
  size?: number;
  iconSize?: number;
  backgroundColor?: string;
  iconColor?: string;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

export function AnimatedPlayButton({
  isPlaying,
  isLoading = false,
  onPress,
  size = 68,
  iconSize = 40,
  backgroundColor,
  iconColor = '#000000',
  accessibilityLabel,
  style,
}: AnimatedPlayButtonProps) {
  const theme = useTheme();
  const activeBgColor = backgroundColor || theme.accent;

  // Shared values for spring scaling and play/pause state transitions
  const pressScale = useSharedValue(1);
  const playStateProgress = useSharedValue(isPlaying ? 1 : 0);

  useEffect(() => {
    playStateProgress.value = withSpring(isPlaying ? 1 : 0, {
      damping: 18,
      stiffness: 220,
      mass: 0.7,
    });
  }, [isPlaying, playStateProgress]);

  const handlePressIn = () => {
    pressScale.value = withSpring(0.88, { damping: 15, stiffness: 350 });
  };

  const handlePressOut = () => {
    pressScale.value = withSpring(1.0, { damping: 12, stiffness: 250, mass: 0.6 });
  };

  // Button wrapper animated style
  const animatedButtonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value }],
  }));

  // Play icon animated style (opacity fade out, scale down, rotate 90deg)
  const playIconStyle = useAnimatedStyle(() => {
    const opacity = interpolate(playStateProgress.value, [0, 0.6, 1], [1, 0.2, 0]);
    const scale = interpolate(playStateProgress.value, [0, 1], [1, 0.6]);
    const rotate = `${interpolate(playStateProgress.value, [0, 1], [0, 90])}deg`;

    return {
      opacity,
      transform: [{ scale }, { rotate }],
    };
  });

  // Pause icon animated style (opacity fade in, scale up, rotate -90deg -> 0deg)
  const pauseIconStyle = useAnimatedStyle(() => {
    const opacity = interpolate(playStateProgress.value, [0, 0.4, 1], [0, 0.2, 1]);
    const scale = interpolate(playStateProgress.value, [0, 1], [0.6, 1]);
    const rotate = `${interpolate(playStateProgress.value, [0, 1], [-90, 0])}deg`;

    return {
      opacity,
      transform: [{ scale }, { rotate }],
    };
  });

  return (
    <Animated.View style={[animatedButtonStyle, style]}>
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={[
          styles.button,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: activeBgColor,
          },
        ]}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel || (isPlaying ? 'Pause' : 'Play')}
      >
        {isLoading ? (
          <ActivityIndicator size="small" color={iconColor} />
        ) : (
          <View style={styles.iconContainer}>
            {/* Play Icon */}
            <Animated.View style={[StyleSheet.absoluteFill, styles.iconCenter, playIconStyle]}>
              <MaterialIcons name="play-arrow" size={iconSize} color={iconColor} />
            </Animated.View>

            {/* Pause Icon */}
            <Animated.View style={[StyleSheet.absoluteFill, styles.iconCenter, pauseIconStyle]}>
              <MaterialIcons name="pause" size={iconSize} color={iconColor} />
            </Animated.View>
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
  },
  iconContainer: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCenter: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default AnimatedPlayButton;
