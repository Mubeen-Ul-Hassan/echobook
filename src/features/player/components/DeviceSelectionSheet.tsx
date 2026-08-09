import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Modal,
  Pressable,
  ScrollView,
  Dimensions,
  LayoutChangeEvent,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { Spacing } from '@/constants/theme';
import { getAudioPlayer } from '@/features/player/services/audio-service';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DEFAULT_SLIDER_WIDTH = SCREEN_WIDTH - Spacing.four * 4 - 60;

interface AudioDevice {
  id: string;
  name: string;
  type: 'speaker' | 'bluetooth' | 'headphones' | 'airplay';
  icon: keyof typeof MaterialIcons.glyphMap;
  isCurrent: boolean;
}

interface DeviceSelectionSheetProps {
  visible: boolean;
  onClose: () => void;
  bottomPadding?: number;
}

const DEFAULT_DEVICES: AudioDevice[] = [
  {
    id: 'device_bt_1',
    name: 'Bluetooth Headphones',
    type: 'bluetooth',
    icon: 'bluetooth-audio',
    isCurrent: true,
  },
  {
    id: 'device_phone_speaker',
    name: 'Phone Speaker',
    type: 'speaker',
    icon: 'speaker-phone',
    isCurrent: false,
  },
  {
    id: 'device_earbuds',
    name: 'Wireless Earbuds',
    type: 'headphones',
    icon: 'headset',
    isCurrent: false,
  },
];

export function DeviceSelectionSheet({
  visible,
  onClose,
  bottomPadding = 24,
}: DeviceSelectionSheetProps) {
  const theme = useTheme();
  const [devices, setDevices] = useState<AudioDevice[]>(DEFAULT_DEVICES);
  const [volume, setVolume] = useState(1.0);
  const [trackWidth, setTrackWidth] = useState(DEFAULT_SLIDER_WIDTH);

  // Sync volume with native player on mount
  useEffect(() => {
    if (visible) {
      try {
        const player = getAudioPlayer();
        if (typeof player.volume === 'number') {
          setVolume(player.volume);
        }
      } catch (err) {
        console.warn('[DeviceSelectionSheet] Failed to read audio player volume:', err);
      }
    }
  }, [visible]);

  // Update volume both locally and in native audio player
  const applyVolume = useCallback((newRatio: number) => {
    const clamped = Math.max(0, Math.min(1, newRatio));
    setVolume(clamped);
    try {
      const player = getAudioPlayer();
      player.volume = clamped;
    } catch (err) {
      console.warn('[DeviceSelectionSheet] Failed to set audio player volume:', err);
    }
  }, []);

  const handleSelectDevice = (deviceId: string) => {
    setDevices((prev) =>
      prev.map((d) => ({
        ...d,
        isCurrent: d.id === deviceId,
      }))
    );
  };

  const handleTrackLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0) setTrackWidth(w);
  };

  const handleTrackPress = (locationX: number) => {
    if (trackWidth <= 0) return;
    const ratio = Math.max(0, Math.min(1, locationX / trackWidth));
    applyVolume(ratio);
  };

  const panGesture = Gesture.Pan()
    .onBegin((event) => {
      'worklet';
      const ratio = Math.max(0, Math.min(1, event.x / trackWidth));
      runOnJS(applyVolume)(ratio);
    })
    .onUpdate((event) => {
      'worklet';
      const ratio = Math.max(0, Math.min(1, event.x / trackWidth));
      runOnJS(applyVolume)(ratio);
    });

  const activeDevice = devices.find((d) => d.isCurrent);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />

        <View
          style={[
            styles.sheetContainer,
            {
              backgroundColor: theme.background,
              borderColor: theme.border,
              paddingBottom: bottomPadding,
            },
          ]}
        >
          {/* Top Header Row with Left Arrow */}
          <View style={styles.headerRow}>
            <Pressable
              onPress={onClose}
              style={({ pressed }) => [
                styles.backBtn,
                { backgroundColor: pressed ? theme.backgroundSelected : theme.backgroundElement },
              ]}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Back"
            >
              <MaterialIcons name="arrow-back" size={22} color={theme.text} />
            </Pressable>

            <View style={styles.headerTitleContainer}>
              <ThemedText style={styles.headerTitle}>Connected to a Device</ThemedText>
              {activeDevice && (
                <ThemedText type="small" themeColor="textSecondary" style={styles.headerSubtitle}>
                  Active: {activeDevice.name}
                </ThemedText>
              )}
            </View>
          </View>

          {/* Middle: Available Devices List */}
          <View style={styles.sectionHeader}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.sectionTitle}>
              AVAILABLE DEVICES
            </ThemedText>
          </View>

          <ScrollView style={styles.deviceList} showsVerticalScrollIndicator={false}>
            {devices.map((device) => {
              const isSelected = device.isCurrent;
              return (
                <Pressable
                  key={device.id}
                  onPress={() => handleSelectDevice(device.id)}
                  style={({ pressed }) => [
                    styles.deviceRow,
                    {
                      backgroundColor: isSelected
                        ? theme.backgroundSelected
                        : pressed
                        ? theme.backgroundElement
                        : 'transparent',
                      borderColor: isSelected ? theme.accent + '66' : 'transparent',
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.deviceIconBg,
                      {
                        backgroundColor: isSelected ? theme.accent : theme.backgroundElement,
                      },
                    ]}
                  >
                    <MaterialIcons
                      name={device.icon}
                      size={22}
                      color={isSelected ? '#000000' : theme.text}
                    />
                  </View>

                  <View style={styles.deviceInfo}>
                    <ThemedText style={[styles.deviceName, isSelected && { color: theme.accent }]}>
                      {device.name}
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {isSelected ? 'Connected' : 'Tap to connect'}
                    </ThemedText>
                  </View>

                  {isSelected && (
                    <MaterialIcons name="check-circle" size={22} color={theme.accent} />
                  )}
                </Pressable>
              );
            })}
          </ScrollView>

          {/* Bottom: Interactive Gesture Volume Bar */}
          <View style={[styles.volumeSection, { backgroundColor: theme.backgroundElement }]}>
            <View style={styles.volumeHeader}>
              <View style={styles.volumeTitleRow}>
                <MaterialIcons name="volume-up" size={20} color={theme.accent} />
                <ThemedText style={styles.volumeLabel}>Volume</ThemedText>
              </View>
              <ThemedText type="small" themeColor="textSecondary" style={styles.volumePercent}>
                {Math.round(volume * 100)}%
              </ThemedText>
            </View>

            <View style={styles.volumeSliderContainer}>
              <Pressable onPress={() => applyVolume(Math.max(0, volume - 0.1))} hitSlop={8}>
                <MaterialIcons name="volume-down" size={20} color={theme.textSecondary} />
              </Pressable>

              <GestureDetector gesture={panGesture}>
                <Pressable
                  style={styles.trackTouchArea}
                  onLayout={handleTrackLayout}
                  onPress={(e) => handleTrackPress(e.nativeEvent.locationX)}
                >
                  <View style={[styles.sliderTrackBg, { backgroundColor: theme.background }]}>
                    <View
                      style={[
                        styles.sliderTrackFill,
                        {
                          backgroundColor: theme.accent,
                          width: `${Math.round(volume * 100)}%`,
                        },
                      ]}
                    />
                    <View
                      style={[
                        styles.thumb,
                        {
                          backgroundColor: theme.accent,
                          left: `${Math.max(0, Math.min(96, volume * 100))}%`,
                        },
                      ]}
                    />
                  </View>
                </Pressable>
              </GestureDetector>

              <Pressable onPress={() => applyVolume(Math.min(1, volume + 0.1))} hitSlop={8}>
                <MaterialIcons name="volume-up" size={20} color={theme.textSecondary} />
              </Pressable>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
  },
  sheetContainer: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    maxHeight: '80%',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.three,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  headerTitleContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  headerSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  sectionHeader: {
    marginVertical: 8,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
  },
  deviceList: {
    marginVertical: 4,
    maxHeight: 220,
  },
  deviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    marginVertical: 4,
  },
  deviceIconBg: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  deviceInfo: {
    flex: 1,
  },
  deviceName: {
    fontSize: 15,
    fontWeight: '700',
  },
  volumeSection: {
    marginTop: 16,
    padding: 16,
    borderRadius: 20,
  },
  volumeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  volumeTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  volumeLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
  volumePercent: {
    fontSize: 13,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  volumeSliderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    height: 36,
  },
  trackTouchArea: {
    flex: 1,
    height: 36,
    justifyContent: 'center',
  },
  sliderTrackBg: {
    height: 8,
    borderRadius: 4,
    justifyContent: 'center',
  },
  sliderTrackFill: {
    height: '100%',
    borderRadius: 4,
  },
  thumb: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 3,
  },
});
