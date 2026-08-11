import React, { useState, useCallback } from 'react';
import {
  StyleSheet,
  ScrollView,
  View,
  Pressable,
  Switch,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSQLiteContext } from 'expo-sqlite';
import { useFocusEffect } from 'expo-router';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { dbService } from '@/database/services';
import { Spacing } from '@/constants/theme';
function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export default function ProfileScreen() {
  const db = useSQLiteContext();
  const theme = useTheme();

  const [stats, setStats] = useState({
    totalBooks: 0,
    completedBooks: 0,
    inProgressBooks: 0,
    totalListenTimeSeconds: 0,
  });

  const [settings, setSettings] = useState({
    autoPlayNext: true,
    skipInterval: 30,
    defaultSpeed: 1.0,
  });

  const loadProfileStats = useCallback(async () => {
    try {
      const books = await dbService.getAudiobooks(db);
      const playbacks = await dbService.getAllPlaybacks(db);

      let completed = 0;
      let inProgress = 0;
      let totalTime = 0;

      for (const pb of playbacks) {
        totalTime += pb.position;
        const book = books.find((b) => b.id === pb.bookId);
        const progress = book && book.duration > 0 ? pb.position / book.duration : 0;
        if (pb.completed === 1 || progress >= 0.99) {
          completed++;
        } else if (progress > 0) {
          inProgress++;
        }
      }

      setStats({
        totalBooks: books.length,
        completedBooks: completed,
        inProgressBooks: inProgress,
        totalListenTimeSeconds: totalTime,
      });
    } catch (err) {
      console.error('[ProfileScreen] Failed to load profile stats:', err);
    }
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      loadProfileStats();
    }, [loadProfileStats])
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Profile Banner / Header */}
        <View style={styles.header}>
          <View style={[styles.avatar, { backgroundColor: theme.accent }]}>
            <MaterialIcons name="person" size={40} color="#000000" />
          </View>
          <ThemedText style={styles.userName}>Audiobook Listener</ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.userSubtitle}>
            Local Library Enthusiast
          </ThemedText>
        </View>

        {/* Listening Analytics */}
        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Listening Stats</ThemedText>
          <View style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
            <View style={styles.statRow}>
              <View style={styles.statItem}>
                <MaterialIcons name="headphones" size={24} color={theme.accent} />
                <ThemedText style={styles.statValue}>
                  {formatDuration(stats.totalListenTimeSeconds)}
                </ThemedText>
                <ThemedText themeColor="textSecondary" style={styles.statLabel}>
                  Time Listened
                </ThemedText>
              </View>

              <View style={styles.statDivider} />

              <View style={styles.statItem}>
                <MaterialIcons name="check-circle" size={24} color={theme.secondary} />
                <ThemedText style={styles.statValue}>{stats.completedBooks}</ThemedText>
                <ThemedText themeColor="textSecondary" style={styles.statLabel}>
                  Completed
                </ThemedText>
              </View>

              <View style={styles.statDivider} />

              <View style={styles.statItem}>
                <MaterialCommunityIcons name="bookshelf" size={24} color={theme.accent} />
                <ThemedText style={styles.statValue}>{stats.totalBooks}</ThemedText>
                <ThemedText themeColor="textSecondary" style={styles.statLabel}>
                  In Library
                </ThemedText>
              </View>
            </View>
          </View>
        </View>

        {/* Playback Settings */}
        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Preferences</ThemedText>
          <View style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
            <View style={styles.settingRow}>
              <View style={styles.settingTextGroup}>
                <ThemedText style={styles.settingLabel}>Auto-play Next Chapter</ThemedText>
                <ThemedText themeColor="textSecondary" style={styles.settingDesc}>
                  Seamlessly transition between chapters
                </ThemedText>
              </View>
              <Switch
                value={settings.autoPlayNext}
                onValueChange={(val) => setSettings((s) => ({ ...s, autoPlayNext: val }))}
                trackColor={{ false: theme.border, true: theme.accent }}
                thumbColor="#FFFFFF"
              />
            </View>

            <View style={[styles.rowDivider, { backgroundColor: theme.border }]} />

            <Pressable
              style={styles.settingRow}
              onPress={() => {
                Alert.alert('Skip Duration', 'Set default skip forward/backward interval to 30 seconds.');
              }}
            >
              <View style={styles.settingTextGroup}>
                <ThemedText style={styles.settingLabel}>Skip Interval</ThemedText>
                <ThemedText themeColor="textSecondary" style={styles.settingDesc}>
                  Seek duration on mini player & full controls
                </ThemedText>
              </View>
              <ThemedText style={[styles.settingValueText, { color: theme.accent }]}>
                {settings.skipInterval}s
              </ThemedText>
            </Pressable>
          </View>
        </View>

        {/* App Info */}
        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>About</ThemedText>
          <View style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
            <View style={styles.infoRow}>
              <ThemedText style={styles.settingLabel}>App Version</ThemedText>
              <ThemedText themeColor="textSecondary">v1.0.0 (Expo SDK 57)</ThemedText>
            </View>
            <View style={[styles.rowDivider, { backgroundColor: theme.border }]} />
            <View style={styles.infoRow}>
              <ThemedText style={styles.settingLabel}>Format Support</ThemedText>
              <ThemedText themeColor="textSecondary">M4B, MP3, AAC, M4A</ThemedText>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    paddingBottom: 160,
    gap: Spacing.four,
  },
  header: {
    alignItems: 'center',
    paddingVertical: Spacing.two,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.two,
    shadowColor: '#F7991C',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  userName: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  userSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  section: {
    gap: Spacing.two,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.1,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: Spacing.three,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 11,
  },
  statDivider: {
    width: 1,
    height: 36,
    backgroundColor: '#E5E7EB',
    opacity: 0.5,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  settingTextGroup: {
    flex: 1,
    paddingRight: Spacing.two,
  },
  settingLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  settingDesc: {
    fontSize: 12,
    marginTop: 2,
  },
  settingValueText: {
    fontSize: 14,
    fontWeight: '600',
  },
  rowDivider: {
    height: 1,
    marginVertical: 10,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
});
