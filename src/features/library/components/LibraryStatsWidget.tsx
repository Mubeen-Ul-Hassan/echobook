import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { MaterialIcons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

interface LibraryStatsWidgetProps {
  totalBooks?: number;
  inProgressCount?: number;
  completedCount: number;
  totalListenedSeconds?: number;
  streakDays?: number;
}

function formatListeningTime(seconds?: number): string {
  if (!seconds || seconds <= 0) return '0m';
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  }
  return `${mins}m`;
}

export function LibraryStatsWidget({
  completedCount,
  totalListenedSeconds = 0,
  streakDays = 0,
}: LibraryStatsWidgetProps) {
  const theme = useTheme();

  return (
    <View style={styles.container}>
      <ThemedText style={styles.sectionTitle}>Your Insights</ThemedText>

      <View style={styles.cardsRow}>
        {/* Stat 1: Total Listened */}
        <View
          style={[
            styles.card,
            {
              backgroundColor: theme.backgroundElement,
              borderColor: theme.border,
            },
          ]}
        >
          <MaterialIcons name="headphones" size={28} color="#10B981" style={styles.icon} />
          <ThemedText style={styles.statValue} numberOfLines={1}>
            {formatListeningTime(totalListenedSeconds)}
          </ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.statLabel} numberOfLines={1}>
            Total Listened
          </ThemedText>
        </View>

        {/* Stat 2: Current Streak */}
        <View
          style={[
            styles.card,
            {
              backgroundColor: theme.backgroundElement,
              borderColor: theme.border,
            },
          ]}
        >
          <MaterialIcons name="local-fire-department" size={28} color="#FF5722" style={styles.icon} />
          <ThemedText style={styles.statValue} numberOfLines={1}>
            {streakDays} {streakDays === 1 ? 'Day' : 'Days'}
          </ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.statLabel} numberOfLines={1}>
            Current Streak
          </ThemedText>
        </View>

        {/* Stat 3: Finished Books */}
        <View
          style={[
            styles.card,
            {
              backgroundColor: theme.backgroundElement,
              borderColor: theme.border,
            },
          ]}
        >
          <MaterialIcons name="menu-book" size={28} color="#F7991C" style={styles.icon} />
          <ThemedText style={styles.statValue} numberOfLines={1}>
            {completedCount} {completedCount === 1 ? 'Book' : 'Books'}
          </ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.statLabel} numberOfLines={1}>
            Finished
          </ThemedText>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: Spacing.four,
    marginBottom: Spacing.three,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  cardsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  card: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  icon: {
    marginBottom: 8,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 4,
    textAlign: 'center',
    opacity: 0.8,
  },
});



