import React from 'react';
import { StyleSheet, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { Spacing } from '@/constants/theme';

interface LibraryStatsWidgetProps {
  totalBooks: number;
  inProgressCount: number;
  completedCount: number;
}

export function LibraryStatsWidget({
  totalBooks,
  inProgressCount,
  completedCount,
}: LibraryStatsWidgetProps) {
  const theme = useTheme();

  return (
    <View style={styles.container}>
      <View style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
        <View style={styles.statItem}>
          <MaterialIcons name="library-books" size={20} color={theme.accent} />
          <ThemedText style={styles.statValue}>{totalBooks}</ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.statLabel}>Total</ThemedText>
        </View>

        <View style={[styles.divider, { backgroundColor: theme.border }]} />

        <View style={styles.statItem}>
          <MaterialIcons name="headphones" size={20} color="#64D2FF" />
          <ThemedText style={styles.statValue}>{inProgressCount}</ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.statLabel}>In Progress</ThemedText>
        </View>

        <View style={[styles.divider, { backgroundColor: theme.border }]} />

        <View style={styles.statItem}>
          <MaterialIcons name="check-circle-outline" size={20} color="#30D158" />
          <ThemedText style={styles.statValue}>{completedCount}</ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.statLabel}>Completed</ThemedText>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: Spacing.four,
    marginBottom: Spacing.four,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 16,
    fontWeight: '800',
    marginTop: 4,
  },
  statLabel: {
    fontSize: 11,
    marginTop: 2,
  },
  divider: {
    width: 1,
    height: 28,
  },
});
