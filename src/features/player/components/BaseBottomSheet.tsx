import React from 'react';
import { StyleSheet, View, Pressable, Modal } from 'react-native';
import Animated, { SlideInDown, SlideOutDown, FadeIn, FadeOut, Easing } from 'react-native-reanimated';
import { MaterialIcons } from '@expo/vector-icons';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

export interface BaseBottomSheetProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  iconName?: keyof typeof MaterialIcons.glyphMap;
  bottomPadding?: number;
  headerRight?: React.ReactNode;
  children: React.ReactNode;
}

export function BaseBottomSheet({
  visible,
  onClose,
  title,
  iconName,
  bottomPadding = 24,
  headerRight,
  children,
}: BaseBottomSheetProps) {
  const theme = useTheme();

  if (!visible) return null;

  return (
    <Modal
      transparent
      visible={visible}
      onRequestClose={onClose}
      animationType="none"
      statusBarTranslucent
    >
      <View style={styles.overlayContainer}>
        {/* Semi-transparent Dark Backdrop */}
        <Animated.View
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(150)}
          style={styles.backdrop}
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        </Animated.View>

        {/* Bottom Sheet Card */}
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
          {/* Drag Handle Bar */}
          <View style={[styles.sheetHandle, { backgroundColor: theme.backgroundSelected }]} />

          {/* Sheet Header */}
          <View style={styles.sheetHeaderRow}>
            <View style={styles.headerTitleGroup}>
              {iconName && (
                <MaterialIcons name={iconName} size={24} color={theme.accent} />
              )}
              <ThemedText style={styles.sheetTitle}>{title}</ThemedText>
            </View>

            <View style={styles.headerRightContainer}>
              {headerRight}
              <Pressable
                onPress={onClose}
                style={({ pressed }) => [
                  styles.closeIconButton,
                  { backgroundColor: theme.backgroundSelected, opacity: pressed ? 0.7 : 1 },
                ]}
                accessibilityRole="button"
                accessibilityLabel="Close sheet"
              >
                <MaterialIcons name="close" size={20} color={theme.text} />
              </Pressable>
            </View>
          </View>

          {/* Sheet Body Content */}
          <View style={styles.contentContainer}>{children}</View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlayContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
  },
  bottomSheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    paddingHorizontal: 20,
    paddingTop: 12,
    maxHeight: '85%',
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
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  headerTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  headerRightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  closeIconButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contentContainer: {
    width: '100%',
  },
});
