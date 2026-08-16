import React, { useEffect } from 'react';
import { StyleSheet, View, Pressable } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePlaybackStore } from '@/hooks/use-playback-store';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

export function PlaybackErrorBanner() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const playbackError = usePlaybackStore((s) => s.playbackError);
  const setPlaybackError = usePlaybackStore((s) => s.setPlaybackError);

  useEffect(() => {
    if (!playbackError) return;
    const timer = setTimeout(() => {
      setPlaybackError(null);
    }, 6000);
    return () => clearTimeout(timer);
  }, [playbackError, setPlaybackError]);

  if (!playbackError) return null;

  return (
    <View
      style={[
        styles.banner,
        {
          top: Math.max(insets.top + 8, 16),
          backgroundColor: '#D32F2F',
        },
      ]}
      accessibilityRole="alert"
      accessibilityLabel={`Playback error: ${playbackError}`}
    >
      <View style={styles.content}>
        <MaterialIcons name="error-outline" size={22} color="#FFFFFF" />
        <ThemedText style={styles.text} numberOfLines={2}>
          {playbackError}
        </ThemedText>
      </View>
      <Pressable
        onPress={() => setPlaybackError(null)}
        style={styles.closeBtn}
        accessibilityRole="button"
        accessibilityLabel="Dismiss error message"
        hitSlop={8}
      >
        <MaterialIcons name="close" size={20} color="#FFFFFF" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 9999,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
    gap: 10,
  },
  text: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  closeBtn: {
    padding: 4,
  },
});
