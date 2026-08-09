import React from 'react';
import { StyleSheet, View, Pressable } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

interface PlayerHeaderProps {
  title: string;
  chapterTitle?: string;
  onClose: () => void;
  onOpenDeviceSheet: () => void;
}

export function PlayerHeader({
  title,
  chapterTitle,
  onClose,
  onOpenDeviceSheet,
}: PlayerHeaderProps) {
  const theme = useTheme();

  return (
    <View style={styles.container}>
      <Pressable
        onPress={onClose}
        style={({ pressed }) => [styles.iconBtn, { opacity: pressed ? 0.7 : 1 }]}
        accessibilityRole="button"
        accessibilityLabel="Minimize player"
      >
        <MaterialIcons name="keyboard-arrow-down" size={32} color={theme.text} />
      </Pressable>

      <View style={styles.titleContainer}>
        <ThemedText numberOfLines={1} style={styles.title}>
          {title || 'Unknown Audiobook'}
        </ThemedText>
        {chapterTitle ? (
          <ThemedText numberOfLines={1} themeColor="textSecondary" style={styles.subtitle}>
            {chapterTitle}
          </ThemedText>
        ) : null}
      </View>

      <Pressable
        onPress={onOpenDeviceSheet}
        style={({ pressed }) => [styles.iconBtn, { opacity: pressed ? 0.7 : 1 }]}
        accessibilityRole="button"
        accessibilityLabel="Output Device Selection"
      >
        <MaterialIcons name="bluetooth-audio" size={24} color="#000000" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  iconBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
  },
  titleContainer: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    marginTop: 2,
    textAlign: 'center',
  },
});
