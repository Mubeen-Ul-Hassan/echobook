import React from 'react';
import { StyleSheet, View, Pressable } from 'react-native';
import Animated, { SlideInDown, SlideOutDown, Easing } from 'react-native-reanimated';
import { MaterialIcons } from '@expo/vector-icons';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

const SPEED_OPTIONS = [0.75, 1.0, 1.25, 1.5, 1.75, 2.0];

interface SpeedSheetProps {
  visible: boolean;
  speed: number;
  onSelectSpeed: (speed: number) => void;
  onClose: () => void;
  bottomPadding?: number;
}

export function SpeedSheet({
  visible,
  speed,
  onSelectSpeed,
  onClose,
  bottomPadding = 24,
}: SpeedSheetProps) {
  const theme = useTheme();

  if (!visible) return null;

  return (
    <Animated.View
      entering={SlideInDown.duration(280).easing(Easing.out(Easing.cubic))}
      exiting={SlideOutDown.duration(200).easing(Easing.in(Easing.cubic))}
      style={[
        styles.bottomSheet,
        {
          backgroundColor: theme.backgroundElement,
          borderColor: theme.border,
          paddingBottom: bottomPadding,
        },
      ]}
    >
      <View style={[styles.sheetHandle, { backgroundColor: theme.backgroundSelected }]} />
      <View style={styles.sheetHeaderRow}>
        <MaterialIcons name="speed" size={22} color={theme.accent} />
        <ThemedText style={styles.sheetTitle}>Playback Speed</ThemedText>
      </View>

      <View style={styles.speedGrid}>
        {SPEED_OPTIONS.map((s) => (
          <Pressable
            key={s}
            onPress={() => {
              onSelectSpeed(s);
              onClose();
            }}
            style={({ pressed }) => [
              styles.speedOption,
              {
                backgroundColor: speed === s ? theme.accent : theme.backgroundSelected,
                borderColor: speed === s ? theme.accent : theme.border,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel={`${s === 1.0 ? '1.0×' : `${s}×`} speed`}
            accessibilityState={{ selected: speed === s }}
          >
            <ThemedText style={[styles.speedOptionText, speed === s ? { color: '#000' } : {}]}>
              {s === 1.0 ? '1.0×' : `${s}×`}
            </ThemedText>
          </Pressable>
        ))}
      </View>

      <Pressable
        onPress={onClose}
        style={[styles.sheetCloseBtn, { backgroundColor: theme.backgroundSelected }]}
        accessibilityRole="button"
        accessibilityLabel="Close speed sheet"
      >
        <ThemedText themeColor="textSecondary" style={{ fontWeight: '600' }}>
          Close
        </ThemedText>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bottomSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    paddingHorizontal: 20,
    paddingTop: 12,
    zIndex: 100,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  sheetHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 20,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  speedGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  speedOption: {
    flex: 1,
    minWidth: '28%',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  speedOptionText: {
    fontSize: 16,
    fontWeight: '700',
  },
  sheetCloseBtn: {
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
