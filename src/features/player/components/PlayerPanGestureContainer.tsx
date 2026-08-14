import React, { useEffect } from 'react';
import { StyleSheet, Dimensions, StyleProp, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const DISMISS_THRESHOLD = 140;
const VELOCITY_THRESHOLD = 800;

export interface PlayerPanGestureContainerProps {
  children: React.ReactNode;
  onClose: () => void;
  enabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function PlayerPanGestureContainer({
  children,
  onClose,
  enabled = true,
  style,
}: PlayerPanGestureContainerProps) {
  const translateY = useSharedValue(0);

  useEffect(() => {
    translateY.value = 0;
  }, [translateY]);

  const handleDismiss = () => {
    onClose();
  };

  const panGesture = Gesture.Pan()
    .enabled(enabled)
    .activeOffsetY([10, 500])
    .onUpdate((event) => {
      'worklet';
      if (event.translationY > 0) {
        // Natural downward drag tracking
        translateY.value = event.translationY;
      } else {
        // Damped upward drag resistance
        translateY.value = event.translationY * 0.15;
      }
    })
    .onEnd((event) => {
      'worklet';
      const shouldDismiss =
        event.translationY > DISMISS_THRESHOLD || event.velocityY > VELOCITY_THRESHOLD;

      if (shouldDismiss) {
        // Animate off screen down, then execute onClose on JS thread
        translateY.value = withTiming(
          SCREEN_HEIGHT,
          { duration: 240 },
          (finished) => {
            if (finished) {
              runOnJS(handleDismiss)();
            }
          }
        );
      } else {
        // Snap back to top position with fluid spring physics
        translateY.value = withSpring(0, {
          damping: 22,
          stiffness: 260,
          mass: 0.8,
        });
      }
    });

  const animatedStyle = useAnimatedStyle(() => {
    // Progress of swipe down (0 to 1)
    const progress = Math.min(1, Math.max(0, translateY.value / SCREEN_HEIGHT));
    const scale = 1 - progress * 0.08;
    const opacity = 1 - progress * 0.3;

    return {
      transform: [
        { translateY: translateY.value },
        { scale },
      ],
      opacity,
    };
  });

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View style={[styles.container, animatedStyle, style]}>
        {children}
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default PlayerPanGestureContainer;
