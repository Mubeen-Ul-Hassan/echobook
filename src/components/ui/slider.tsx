import React, { useRef, useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  PanResponder,
  LayoutChangeEvent,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { useTheme } from '@/hooks/use-theme';

export interface SliderProps {
  value: number;
  minimumValue?: number;
  maximumValue?: number;
  step?: number;
  disabled?: boolean;
  onValueChange?: (value: number) => void;
  onSlidingComplete?: (value: number) => void;
  formatTime?: (seconds: number) => string;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

export function Slider({
  value,
  minimumValue = 0,
  maximumValue = 100,
  step = 1,
  disabled = false,
  onValueChange,
  onSlidingComplete,
  formatTime,
  style,
  accessibilityLabel = 'Audio playback progress slider',
}: SliderProps) {
  const theme = useTheme();
  const [sliderWidth, setSliderWidth] = useState<number>(0);
  const [isSliding, setIsSliding] = useState<boolean>(false);
  const [slidingValue, setSlidingValue] = useState<number | null>(null);

  const activeValue = isSliding && slidingValue !== null ? slidingValue : value;
  const range = Math.max(1, maximumValue - minimumValue);
  const progressPercent = Math.min(100, Math.max(0, ((activeValue - minimumValue) / range) * 100));

  const updateValueFromX = useCallback(
    (x: number) => {
      if (sliderWidth <= 0 || disabled) return minimumValue;
      const clampedX = Math.max(0, Math.min(x, sliderWidth));
      const ratio = clampedX / sliderWidth;
      let rawVal = minimumValue + ratio * range;

      if (step > 0) {
        rawVal = Math.round(rawVal / step) * step;
      }
      return Math.max(minimumValue, Math.min(maximumValue, rawVal));
    },
    [sliderWidth, disabled, minimumValue, range, step, maximumValue]
  );

  const sliderWidthRef = useRef(sliderWidth);
  sliderWidthRef.current = sliderWidth;

  const updateValueRef = useRef(updateValueFromX);
  updateValueRef.current = updateValueFromX;

  const onSlidingCompleteRef = useRef(onSlidingComplete);
  onSlidingCompleteRef.current = onSlidingComplete;

  const onValueChangeRef = useRef(onValueChange);
  onValueChangeRef.current = onValueChange;

  const grantXRef = useRef<number>(0);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !disabled,
      onMoveShouldSetPanResponder: () => !disabled,

      onPanResponderGrant: (evt) => {
        setIsSliding(true);
        grantXRef.current = evt.nativeEvent.locationX;
        const newVal = updateValueRef.current(grantXRef.current);
        setSlidingValue(newVal);
        if (onValueChangeRef.current) {
          onValueChangeRef.current(newVal);
        }
      },

      onPanResponderMove: (_evt, gestureState) => {
        const touchX = grantXRef.current + gestureState.dx;
        const newVal = updateValueRef.current(touchX);
        setSlidingValue(newVal);
        if (onValueChangeRef.current) {
          onValueChangeRef.current(newVal);
        }
      },

      onPanResponderRelease: (_evt, gestureState) => {
        const touchX = grantXRef.current + gestureState.dx;
        const finalVal = updateValueRef.current(touchX);
        setIsSliding(false);
        setSlidingValue(null);
        if (onSlidingCompleteRef.current) {
          onSlidingCompleteRef.current(finalVal);
        }
      },

      onPanResponderTerminate: () => {
        setIsSliding(false);
        setSlidingValue(null);
      },
    })
  ).current;

  const handleLayout = (e: LayoutChangeEvent) => {
    const width = e.nativeEvent.layout.width;
    if (width > 0) {
      setSliderWidth(width);
    }
  };

  return (
    <View
      style={[styles.container, style]}
      onLayout={handleLayout}
      accessibilityRole="adjustable"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{
        min: minimumValue,
        max: maximumValue,
        now: activeValue,
        text: formatTime ? formatTime(activeValue) : `${Math.round(activeValue)}s`,
      }}
      {...panResponder.panHandlers}
    >
      {/* Track Background */}
      <View style={[styles.trackBackground, { backgroundColor: theme.backgroundElement }]}>
        {/* Progress Fill */}
        <View
          style={[
            styles.trackFill,
            {
              width: `${progressPercent}%`,
              backgroundColor: theme.accent,
            },
          ]}
        />
      </View>

      {/* Scrubbing Thumb Handle */}
      <View
        style={[
          styles.thumb,
          {
            left: `${progressPercent}%`,
            backgroundColor: theme.accent,
            borderColor: '#FFFFFF',
            transform: [{ translateX: -10 }],
            scaleX: isSliding ? 1.25 : 1,
            scaleY: isSliding ? 1.25 : 1,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 44, // Minimum 44px touch target height for accessibility
    justifyContent: 'center',
    width: '100%',
    position: 'relative',
  },
  trackBackground: {
    height: 6,
    borderRadius: 3,
    width: '100%',
    overflow: 'hidden',
  },
  trackFill: {
    height: '100%',
    borderRadius: 3,
  },
  thumb: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
});

export default Slider;
