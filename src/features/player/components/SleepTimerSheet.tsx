import React from 'react';
import { StyleSheet, View, Pressable } from 'react-native';
import Animated, { SlideInDown, SlideOutDown, Easing } from 'react-native-reanimated';
import { MaterialIcons } from '@expo/vector-icons';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

const SLEEP_OPTIONS: { label: string; value: number | 'chapter' }[] = [
  { label: '10m', value: 600 },
  { label: '15m', value: 900 },
  { label: '20m', value: 1200 },
  { label: '30m', value: 1800 },
  { label: '45m', value: 2700 },
  { label: '60m', value: 3600 },
  { label: 'End of chapter', value: 'chapter' },
];

interface SleepTimerSheetProps {
  visible: boolean;
  sleepTimerType: 'time' | 'chapter' | null;
  sleepTimerDuration: number | null;
  onStartTimer: (val: number, type: 'time' | 'chapter') => void;
  onClearTimer: () => void;
  onClose: () => void;
  bottomPadding?: number;
}

export function SleepTimerSheet({
  visible,
  sleepTimerType,
  sleepTimerDuration,
  onStartTimer,
  onClearTimer,
  onClose,
  bottomPadding = 24,
}: SleepTimerSheetProps) {
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
        <MaterialIcons name="timer" size={22} color={theme.accent} />
        <ThemedText style={styles.sheetTitle}>Sleep Timer</ThemedText>
      </View>

      {sleepTimerType && (
        <Pressable
          onPress={() => {
            onClearTimer();
            onClose();
          }}
          style={[styles.clearTimerBtn, { backgroundColor: '#5C1A1A' }]}
          accessibilityRole="button"
          accessibilityLabel="Cancel sleep timer"
        >
          <MaterialIcons name="close" size={18} color="#FF6B6B" />
          <ThemedText style={[styles.clearTimerText, { color: '#FF6B6B' }]}>
            Cancel Timer
          </ThemedText>
        </Pressable>
      )}

      <View style={styles.sleepGrid}>
        {SLEEP_OPTIONS.map((opt) => {
          const isActive =
            (sleepTimerType === 'time' &&
              typeof opt.value === 'number' &&
              opt.value === sleepTimerDuration) ||
            (sleepTimerType === 'chapter' && opt.value === 'chapter');

          return (
            <Pressable
              key={String(opt.value)}
              onPress={() => {
                if (typeof opt.value === 'number') {
                  onStartTimer(opt.value, 'time');
                } else {
                  onStartTimer(0, 'chapter');
                }
                onClose();
              }}
              style={({ pressed }) => [
                styles.sleepOption,
                {
                  backgroundColor: isActive ? theme.accent : theme.backgroundSelected,
                  borderColor: isActive ? theme.accent : theme.border,
                  opacity: pressed ? 0.85 : 1,
                },
                opt.value === 'chapter' && { width: '100%', marginTop: 4 },
              ]}
              accessibilityRole="button"
              accessibilityLabel={`Sleep after ${opt.label}`}
              accessibilityState={{ selected: isActive }}
            >
              <ThemedText
                style={[styles.sleepOptionText, isActive ? { color: '#000' } : {}]}
              >
                {opt.label}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>

      <Pressable
        onPress={onClose}
        style={[styles.sheetCloseBtn, { backgroundColor: theme.backgroundSelected }]}
        accessibilityRole="button"
        accessibilityLabel="Close sleep timer sheet"
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
    marginBottom: 16,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  clearTimerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
    marginBottom: 16,
  },
  clearTimerText: {
    fontWeight: '700',
    fontSize: 14,
  },
  sleepGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  sleepOption: {
    flex: 1,
    minWidth: '28%',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  sleepOptionText: {
    fontSize: 15,
    fontWeight: '700',
  },
  sheetCloseBtn: {
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
