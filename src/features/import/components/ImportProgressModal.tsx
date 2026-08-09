import React from 'react';
import { StyleSheet, View, ActivityIndicator } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { MaterialIcons } from '@expo/vector-icons';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

interface ImportProgressModalProps {
  visible: boolean;
  stage: string;
  percent?: number;
}

export function ImportProgressModal({ visible, stage, percent }: ImportProgressModalProps) {
  const theme = useTheme();

  if (!visible) return null;

  const validPercent = typeof percent === 'number' ? Math.max(0, Math.min(100, percent)) : undefined;

  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      exiting={FadeOut.duration(150)}
      style={styles.overlay}
    >
      <View style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
        <View style={[styles.iconCircle, { backgroundColor: theme.backgroundSelected }]}>
          <MaterialIcons name="cloud-upload" size={32} color={theme.accent} />
        </View>

        <ThemedText style={styles.title}>Importing Audiobook</ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.stageText} numberOfLines={2}>
          {stage || 'Processing file...'}
        </ThemedText>

        {/* Progress bar */}
        {validPercent !== undefined && (
          <View style={styles.progressContainer}>
            <View style={[styles.progressTrack, { backgroundColor: theme.backgroundSelected }]}>
              <View
                style={[
                  styles.progressFill,
                  { backgroundColor: theme.accent, width: `${validPercent}%` },
                ]}
              />
            </View>
            <ThemedText themeColor="textSecondary" style={styles.percentText}>
              {validPercent}%
            </ThemedText>
          </View>
        )}

        <ActivityIndicator size="small" color={theme.accent} style={styles.spinner} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 10,
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 6,
    textAlign: 'center',
  },
  stageText: {
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 18,
  },
  progressContainer: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 12,
  },
  progressTrack: {
    width: '100%',
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 6,
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  percentText: {
    fontSize: 12,
    fontWeight: '700',
  },
  spinner: {
    marginTop: 4,
  },
});
