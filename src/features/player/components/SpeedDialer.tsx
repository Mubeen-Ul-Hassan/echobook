import React, { useMemo, useCallback } from 'react';
import { StyleSheet, View, Pressable, Platform } from 'react-native';
import WheelPicker from 'react-native-wheely';
import { MaterialIcons } from '@expo/vector-icons';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';

interface SpeedDialerProps {
  speed: number;
  onSpeedChange: (speed: number) => void;
  minSpeed?: number;
  maxSpeed?: number;
  step?: number;
}

export function SpeedDialer({
  speed,
  onSpeedChange,
  minSpeed = 0.5,
  maxSpeed = 3.5,
  step = 0.05,
}: SpeedDialerProps) {
  const theme = useTheme();

  // Generate array of speed values from minSpeed to maxSpeed
  const speedValues = useMemo(() => {
    const values: number[] = [];
    const totalSteps = Math.round((maxSpeed - minSpeed) / step);
    for (let i = 0; i <= totalSteps; i++) {
      values.push(Number((minSpeed + i * step).toFixed(2)));
    }
    return values;
  }, [minSpeed, maxSpeed, step]);

  // Formatted string options for the wheel picker
  const speedOptions = useMemo(() => {
    return speedValues.map((s) => (s === 1.0 ? '1.00× (Normal)' : `${s.toFixed(2)}×`));
  }, [speedValues]);

  // Current selected index in the options array
  const selectedIndex = useMemo(() => {
    const idx = speedValues.findIndex((s) => Math.abs(s - speed) < 0.025);
    return idx >= 0 ? idx : speedValues.findIndex((s) => s === 1.0);
  }, [speedValues, speed]);

  const handleReset = useCallback(() => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onSpeedChange(1.0);
  }, [onSpeedChange]);

  const handleWheelChange = useCallback(
    (index: number) => {
      if (speedValues[index] !== undefined && index !== selectedIndex) {
        if (Platform.OS !== 'web') {
          Haptics.selectionAsync();
        }
        onSpeedChange(speedValues[index]);
      }
    },
    [speedValues, selectedIndex, onSpeedChange]
  );

  const ITEM_HEIGHT = 56;
  const VISIBLE_REST = 3; // Show 3 items above and below

  return (
    <View style={styles.container}>
      {/* Refined Wheel Picker Container */}
      <View style={styles.wheelWrapper}>
        <WheelPicker
          selectedIndex={selectedIndex}
          options={speedOptions}
          onChange={handleWheelChange}
          itemHeight={ITEM_HEIGHT}
          visibleRest={VISIBLE_REST}
          containerStyle={styles.wheelContainerStyle}
          selectedIndicatorStyle={[
            styles.wheelIndicatorStyle,
            { borderColor: theme.accent },
          ]}
          itemTextStyle={{
            fontSize: 22,
            fontWeight: '600',
            textAlign: 'center',
            color: theme.text,
            fontVariant: ['tabular-nums'],
          }}
        />
        {/* Top Fade Gradient */}
        <LinearGradient
          colors={[theme.background, 'transparent']}
          style={[styles.gradientTop, { height: ITEM_HEIGHT * 1.5 }]}
          pointerEvents="none"
        />
        {/* Bottom Fade Gradient */}
        <LinearGradient
          colors={['transparent', theme.background]}
          style={[styles.gradientBottom, { height: ITEM_HEIGHT * 1.5 }]}
          pointerEvents="none"
        />
      </View>

      {/* Reset Action Button */}
      {speed !== 1.0 && (
        <Pressable
          onPress={handleReset}
          style={({ pressed }) => [
            styles.resetBtn,
            { 
              backgroundColor: theme.backgroundSelected,
              borderColor: theme.border,
              opacity: pressed ? 0.7 : 1 
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Reset speed to 1.0"
        >
          <MaterialIcons name="refresh" size={16} color={theme.text} />
          <ThemedText style={styles.resetText}>
            Reset to 1.0×
          </ThemedText>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    width: '100%',
    paddingVertical: 12,
  },
  wheelWrapper: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  wheelContainerStyle: {
    width: '100%',
  },
  wheelIndicatorStyle: {
    backgroundColor: 'transparent',
    borderTopWidth: 2,
    borderBottomWidth: 2,
    borderRadius: 0,
    marginHorizontal: 32,
  },
  gradientTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  gradientBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 24,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 24,
    borderWidth: 1,
  },
  resetText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
