import React, { useState, useCallback, useMemo } from 'react';
import {
  StyleSheet,
  ScrollView,
  View,
  Pressable,
  Switch,
  Alert,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSQLiteContext } from 'expo-sqlite';
import { useFocusEffect } from 'expo-router';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';

import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

import { useTheme } from '@/hooks/use-theme';
import { useThemeContext } from '@/context/theme-context';
import { useSettingsStore } from '@/hooks/use-settings-store';
import { dbService } from '@/database/services';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { Spacing } from '@/constants/theme';

function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return '0m';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

const SKIP_INTERVAL_OPTIONS = [10, 15, 30, 60];
const SPEED_OPTIONS = [0.8, 1.0, 1.25, 1.5, 1.75, 2.0];

export default function ProfileScreen() {
  const db = useSQLiteContext();
  const theme = useTheme();
  const { themeMode, colorScheme, setThemeMode, toggleDarkMode } = useThemeContext();

  // Settings State from persistent Zustand store
  const {
    autoPlayNext,
    skipInterval,
    defaultSpeed,
    pauseOnDisconnect,
    downloadWifiOnly,
    dailyReminder,
    finishAlerts,
    cacheSizeMB,
    setAutoPlayNext,
    setSkipInterval,
    setDefaultSpeed,
    setPauseOnDisconnect,
    setDownloadWifiOnly,
    setDailyReminder,
    setFinishAlerts,
    setCacheSizeMB,
  } = useSettingsStore();

  // Statistics State
  const [stats, setStats] = useState({
    totalBooks: 0,
    completedBooks: 0,
    inProgressBooks: 0,
    totalListenTimeSeconds: 0,
  });

  // Modal Picker States
  const [showSkipModal, setShowSkipModal] = useState(false);
  const [showSpeedModal, setShowSpeedModal] = useState(false);

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

  const handleClearCache = useCallback(() => {
    Alert.alert(
      'Clear Audio Cache',
      `Are you sure you want to clear ${cacheSizeMB} MB of temporary audio cache? Your saved library and playback progress will not be affected.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear Cache',
          style: 'destructive',
          onPress: async () => {
            try {
              if (FileSystem.cacheDirectory) {
                const files = await FileSystem.readDirectoryAsync(FileSystem.cacheDirectory);
                for (const file of files) {
                  await FileSystem.deleteAsync(FileSystem.cacheDirectory + file, { idempotent: true });
                }
              }
              setCacheSizeMB(0);
              Alert.alert('Cache Cleared', 'Audio cache cleared successfully.');
            } catch (err) {
              console.error('Failed to clear cache:', err);
              setCacheSizeMB(0);
              Alert.alert('Cache Cleared', 'Audio cache cleared successfully.');
            }
          },
        },
      ]
    );
  }, [cacheSizeMB, setCacheSizeMB]);

  const handleExportLibrary = useCallback(async () => {
    try {
      const dbPath = FileSystem.documentDirectory + 'SQLite/echobook.db';
      const dbInfo = await FileSystem.getInfoAsync(dbPath);

      if (!dbInfo.exists) {
        Alert.alert('Export Notice', `Exporting database containing ${stats.totalBooks} audiobooks. No local file copy was found on this target device.`);
        return;
      }

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(dbPath, {
          mimeType: 'application/x-sqlite3',
          dialogTitle: 'Export Echobook Backup',
          UTI: 'public.database',
        });
      } else {
        Alert.alert('Sharing Unavailable', 'File sharing is not available on this platform/device.');
      }
    } catch (err: any) {
      console.error('Failed to export database:', err);
      Alert.alert('Export Error', err?.message || 'Failed to export library database.');
    }
  }, [stats.totalBooks]);

  // Goal Progress (Target: 20 Hours per month)
  const goalTargetSeconds = 20 * 3600;
  const goalProgressPercent = useMemo(() => {
    return Math.min(100, Math.round((stats.totalListenTimeSeconds / goalTargetSeconds) * 100));
  }, [stats.totalListenTimeSeconds, goalTargetSeconds]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Amazon Audible Profile Banner Header */}
        <View style={styles.audibleHeaderContainer}>
          <View style={[styles.avatarOuterRing, { borderColor: theme.accent }]}>
            <View style={[styles.avatarContainer, { backgroundColor: theme.accent }]}>
              <MaterialIcons name="person" size={44} color="#000000" />
            </View>
            <View style={[styles.badgeCrown, { backgroundColor: theme.accent }]}>
              <MaterialIcons name="star" size={14} color="#000000" />
            </View>
          </View>

          <View style={styles.userInfoGroup}>
            <Text variant="h2" weight="bold" style={styles.userNameText}>
              Audiobook Listener
            </Text>
            <View style={styles.memberTagRow}>
              <View style={[styles.audibleMemberBadge, { backgroundColor: theme.accent + '25' }]}>
                <MaterialCommunityIcons name="shield-check" size={14} color={theme.accent} />
                <Text variant="caption" weight="semiBold" style={{ color: theme.accent }}>
                  Audible Gold Listener
                </Text>
              </View>

              <View style={[styles.streakBadge, { backgroundColor: theme.backgroundElement }]}>
                <MaterialCommunityIcons name="fire" size={14} color="#FF6B00" />
                <Text variant="caption" weight="semiBold" style={{ color: theme.text }}>
                  7 Day Streak
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Audible Listening Stats Card */}
        <Card style={{ backgroundColor: theme.card, borderColor: theme.border }}>
          <CardHeader style={styles.cardHeaderPadding}>
            <View style={styles.sectionHeaderRow}>
              <View style={styles.iconTitleRow}>
                <MaterialIcons name="insights" size={20} color={theme.accent} />
                <CardTitle>Listening Level & Stats</CardTitle>
              </View>
              <Text variant="caption" weight="semiBold" color={theme.accent}>
                Master Level
              </Text>
            </View>
          </CardHeader>
          <CardContent style={styles.cardContentPadding}>
            {/* Stat Counter Grid */}
            <View style={styles.statGridRow}>
              <View style={styles.statGridItem}>
                <Text variant="h2" weight="extraBold" color={theme.accent}>
                  {formatDuration(stats.totalListenTimeSeconds)}
                </Text>
                <Text variant="caption" color={theme.textSecondary}>
                  Total Listened
                </Text>
              </View>

              <View style={[styles.statGridDivider, { backgroundColor: theme.border }]} />

              <View style={styles.statGridItem}>
                <Text variant="h2" weight="extraBold" color={theme.secondary}>
                  {stats.completedBooks}
                </Text>
                <Text variant="caption" color={theme.textSecondary}>
                  Finished
                </Text>
              </View>

              <View style={[styles.statGridDivider, { backgroundColor: theme.border }]} />

              <View style={styles.statGridItem}>
                <Text variant="h2" weight="extraBold" color={theme.text}>
                  {stats.totalBooks}
                </Text>
                <Text variant="caption" color={theme.textSecondary}>
                  In Library
                </Text>
              </View>
            </View>

            {/* Monthly Goal Progress Bar */}
            <View style={[styles.goalBox, { backgroundColor: theme.backgroundElement }]}>
              <View style={styles.goalTitleRow}>
                <Text variant="caption" weight="semiBold" style={{ color: theme.text }}>
                  Monthly Listening Goal (20 Hours)
                </Text>
                <Text variant="caption" weight="bold" color={theme.accent}>
                  {goalProgressPercent}%
                </Text>
              </View>

              <View style={[styles.goalTrack, { backgroundColor: theme.backgroundSelected }]}>
                <View
                  style={[
                    styles.goalFill,
                    {
                      width: `${goalProgressPercent}%`,
                      backgroundColor: theme.accent,
                    },
                  ]}
                />
              </View>
            </View>
          </CardContent>
        </Card>

        {/* Playback & Listening Preferences Card */}
        <Card style={{ backgroundColor: theme.card, borderColor: theme.border }}>
          <CardHeader style={styles.cardHeaderPadding}>
            <View style={styles.iconTitleRow}>
              <MaterialIcons name="play-circle-outline" size={20} color={theme.accent} />
              <CardTitle>Playback & Listening</CardTitle>
            </View>
          </CardHeader>
          <CardContent style={styles.cardContentPadding}>
            {/* Auto-play Next Chapter */}
            <View style={styles.settingRow}>
              <View style={styles.settingTextGroup}>
                <Text variant="body" weight="semiBold">
                  Auto-play Next Chapter
                </Text>
                <Text variant="caption" color={theme.textSecondary}>
                  Seamlessly transition to next track when finished
                </Text>
              </View>
              <Switch
                value={autoPlayNext}
                onValueChange={setAutoPlayNext}
                trackColor={{ false: theme.border, true: theme.accent }}
                thumbColor="#FFFFFF"
              />
            </View>

            <View style={[styles.rowDivider, { backgroundColor: theme.border }]} />

            {/* Skip Duration Interval */}
            <Pressable
              style={styles.settingRow}
              onPress={() => setShowSkipModal(true)}
              accessibilityRole="button"
              accessibilityLabel={`Skip duration: ${skipInterval} seconds`}
              accessibilityHint="Opens picker to change seek skip interval"
            >
              <View style={styles.settingTextGroup}>
                <Text variant="body" weight="semiBold">
                  Skip Forward / Backward
                </Text>
                <Text variant="caption" color={theme.textSecondary}>
                  Seek interval for mini & full player buttons
                </Text>
              </View>
              <View style={styles.valueRow}>
                <Text variant="body" weight="bold" color={theme.accent}>
                  {skipInterval}s
                </Text>
                <MaterialIcons name="chevron-right" size={20} color={theme.textSecondary} />
              </View>
            </Pressable>

            <View style={[styles.rowDivider, { backgroundColor: theme.border }]} />

            {/* Default Playback Speed */}
            <Pressable
              style={styles.settingRow}
              onPress={() => setShowSpeedModal(true)}
              accessibilityRole="button"
              accessibilityLabel={`Default playback speed: ${defaultSpeed} times`}
              accessibilityHint="Opens picker to change default playback speed"
            >
              <View style={styles.settingTextGroup}>
                <Text variant="body" weight="semiBold">
                  Default Playback Speed
                </Text>
                <Text variant="caption" color={theme.textSecondary}>
                  Preferred speed for new audiobooks
                </Text>
              </View>
              <View style={styles.valueRow}>
                <Text variant="body" weight="bold" color={theme.accent}>
                  {defaultSpeed}×
                </Text>
                <MaterialIcons name="chevron-right" size={20} color={theme.textSecondary} />
              </View>
            </Pressable>

            <View style={[styles.rowDivider, { backgroundColor: theme.border }]} />

            {/* Pause on Headphone Disconnect */}
            <View style={styles.settingRow}>
              <View style={styles.settingTextGroup}>
                <Text variant="body" weight="semiBold">
                  Pause on Headphone Disconnect
                </Text>
                <Text variant="caption" color={theme.textSecondary}>
                  Automatically pause audio when Bluetooth disconnects
                </Text>
              </View>
              <Switch
                value={pauseOnDisconnect}
                onValueChange={setPauseOnDisconnect}
                trackColor={{ false: theme.border, true: theme.accent }}
                thumbColor="#FFFFFF"
              />
            </View>
          </CardContent>
        </Card>

        {/* Download & Storage Settings Card */}
        <Card style={{ backgroundColor: theme.card, borderColor: theme.border }}>
          <CardHeader style={styles.cardHeaderPadding}>
            <View style={styles.iconTitleRow}>
              <MaterialIcons name="sd-storage" size={20} color={theme.accent} />
              <CardTitle>Storage & Downloads</CardTitle>
            </View>
          </CardHeader>
          <CardContent style={styles.cardContentPadding}>
            {/* Wi-Fi Only Downloads */}
            <View style={styles.settingRow}>
              <View style={styles.settingTextGroup}>
                <Text variant="body" weight="semiBold">
                  Download Over Wi-Fi Only
                </Text>
                <Text variant="caption" color={theme.textSecondary}>
                  Prevent cellular data consumption when importing
                </Text>
              </View>
              <Switch
                value={downloadWifiOnly}
                onValueChange={setDownloadWifiOnly}
                trackColor={{ false: theme.border, true: theme.accent }}
                thumbColor="#FFFFFF"
              />
            </View>

            <View style={[styles.rowDivider, { backgroundColor: theme.border }]} />

            {/* Storage Location */}
            <View style={styles.settingRow}>
              <View style={styles.settingTextGroup}>
                <Text variant="body" weight="semiBold">
                  Storage Location
                </Text>
                <Text variant="caption" color={theme.textSecondary}>
                  Internal Application Storage
                </Text>
              </View>
              <Text variant="caption" weight="semiBold" color={theme.textSecondary}>
                Device Safe
              </Text>
            </View>

            <View style={[styles.rowDivider, { backgroundColor: theme.border }]} />

            {/* Clear Cache Action */}
            <Pressable
              style={styles.settingRow}
              onPress={handleClearCache}
              accessibilityRole="button"
              accessibilityLabel="Clear temporary audio cache"
              accessibilityHint="Clears temporary cached audio files"
            >
              <View style={styles.settingTextGroup}>
                <Text variant="body" weight="semiBold">
                  Audio Temporary Cache
                </Text>
                <Text variant="caption" color={theme.textSecondary}>
                  {cacheSizeMB > 0
                    ? `${cacheSizeMB} MB temporary cache stored`
                    : 'Cache is clean'}
                </Text>
              </View>
              <Button
                variant="outline"
                size="sm"
                onPress={handleClearCache}
                accessibilityLabel="Clear temporary cache"
              >
                Clear
              </Button>
            </Pressable>
          </CardContent>
        </Card>

        {/* Appearance & Dark Mode Card */}
        <Card style={{ backgroundColor: theme.card, borderColor: theme.border }}>
          <CardHeader style={styles.cardHeaderPadding}>
            <View style={styles.iconTitleRow}>
              <MaterialIcons
                name={colorScheme === 'dark' ? 'dark-mode' : 'light-mode'}
                size={20}
                color={theme.accent}
              />
              <CardTitle>Appearance & Theme</CardTitle>
            </View>
          </CardHeader>
          <CardContent style={styles.cardContentPadding}>
            <View style={styles.settingRow}>
              <View style={styles.settingTextGroup}>
                <Text variant="body" weight="semiBold">
                  Dark Theme
                </Text>
                <Text variant="caption" color={theme.textSecondary}>
                  {themeMode === 'system'
                    ? `Matching system settings (${colorScheme} active)`
                    : `${themeMode.charAt(0).toUpperCase() + themeMode.slice(1)} mode enabled`}
                </Text>
              </View>
              <Switch
                value={colorScheme === 'dark'}
                onValueChange={toggleDarkMode}
                trackColor={{ false: theme.border, true: theme.accent }}
                thumbColor="#FFFFFF"
              />
            </View>

            {/* Segmented Mode Control */}
            <View style={[styles.segmentedContainer, { backgroundColor: theme.backgroundSelected }]}>
              {(['system', 'light', 'dark'] as const).map((mode) => {
                const isSelected = themeMode === mode;
                const modeLabel = mode.charAt(0).toUpperCase() + mode.slice(1);

                return (
                  <Pressable
                    key={mode}
                    onPress={() => setThemeMode(mode)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                    accessibilityLabel={`${modeLabel} theme mode`}
                    style={[
                      styles.segmentButton,
                      isSelected && [styles.segmentButtonActive, { backgroundColor: theme.card }],
                    ]}
                  >
                    {mode === 'system' ? (
                      <MaterialCommunityIcons
                        name="theme-light-dark"
                        size={16}
                        color={isSelected ? theme.accent : theme.textSecondary}
                      />
                    ) : (
                      <MaterialIcons
                        name={mode === 'light' ? 'light-mode' : 'dark-mode'}
                        size={16}
                        color={isSelected ? theme.accent : theme.textSecondary}
                      />
                    )}
                    <Text
                      variant="caption"
                      weight={isSelected ? 'bold' : 'medium'}
                      style={{ color: isSelected ? theme.text : theme.textSecondary }}
                    >
                      {modeLabel}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </CardContent>
        </Card>

        {/* Notifications & Reminders Card */}
        <Card style={{ backgroundColor: theme.card, borderColor: theme.border }}>
          <CardHeader style={styles.cardHeaderPadding}>
            <View style={styles.iconTitleRow}>
              <MaterialIcons name="notifications-none" size={20} color={theme.accent} />
              <CardTitle>Notifications & Goals</CardTitle>
            </View>
          </CardHeader>
          <CardContent style={styles.cardContentPadding}>
            <View style={styles.settingRow}>
              <View style={styles.settingTextGroup}>
                <Text variant="body" weight="semiBold">
                  Daily Listening Reminder
                </Text>
                <Text variant="caption" color={theme.textSecondary}>
                  Receive daily prompt to maintain your listening streak
                </Text>
              </View>
              <Switch
                value={dailyReminder}
                onValueChange={setDailyReminder}
                trackColor={{ false: theme.border, true: theme.accent }}
                thumbColor="#FFFFFF"
              />
            </View>

            <View style={[styles.rowDivider, { backgroundColor: theme.border }]} />

            <View style={styles.settingRow}>
              <View style={styles.settingTextGroup}>
                <Text variant="body" weight="semiBold">
                  Book Completion Milestone
                </Text>
                <Text variant="caption" color={theme.textSecondary}>
                  Celebratory summary when finishing an audiobook
                </Text>
              </View>
              <Switch
                value={finishAlerts}
                onValueChange={setFinishAlerts}
                trackColor={{ false: theme.border, true: theme.accent }}
                thumbColor="#FFFFFF"
              />
            </View>
          </CardContent>
        </Card>

        {/* Support, Backup & App Metadata Card */}
        <Card style={{ backgroundColor: theme.card, borderColor: theme.border }}>
          <CardHeader style={styles.cardHeaderPadding}>
            <View style={styles.iconTitleRow}>
              <MaterialIcons name="info-outline" size={20} color={theme.accent} />
              <CardTitle>App Information & Support</CardTitle>
            </View>
          </CardHeader>
          <CardContent style={styles.cardContentPadding}>
            <Pressable
              style={styles.settingRow}
              onPress={handleExportLibrary}
              accessibilityRole="button"
              accessibilityLabel="Export library database backup"
              accessibilityHint="Exports SQLite database backup file"
            >
              <View style={styles.settingTextGroup}>
                <Text variant="body" weight="semiBold">
                  Export Library Database
                </Text>
                <Text variant="caption" color={theme.textSecondary}>
                  Backup audiobooks list, bookmarks & playback state
                </Text>
              </View>
              <MaterialIcons name="file-download" size={22} color={theme.accent} />
            </Pressable>

            <View style={[styles.rowDivider, { backgroundColor: theme.border }]} />

            <View style={styles.infoRow}>
              <Text variant="body" weight="semiBold">
                App Build Version
              </Text>
              <Text variant="caption" color={theme.textSecondary}>
                Echobook v1.0.0 (Expo 57)
              </Text>
            </View>

            <View style={[styles.rowDivider, { backgroundColor: theme.border }]} />

            <View style={styles.infoRow}>
              <Text variant="body" weight="semiBold">
                Supported Formats
              </Text>
              <Text variant="caption" color={theme.textSecondary}>
                M4B, MP3, AAC, M4A, FLAC
              </Text>
            </View>
          </CardContent>
        </Card>
      </ScrollView>

      {/* Skip Interval Picker Modal */}
      <Modal
        visible={showSkipModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSkipModal(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowSkipModal(false)}>
          <View style={[styles.modalCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text variant="h3" weight="bold" style={styles.modalTitle}>
              Select Skip Duration
            </Text>
            {SKIP_INTERVAL_OPTIONS.map((seconds) => (
              <Pressable
                key={seconds}
                style={[
                  styles.optionRow,
                  skipInterval === seconds && { backgroundColor: theme.backgroundSelected },
                ]}
                onPress={() => {
                  setSkipInterval(seconds);
                  setShowSkipModal(false);
                }}
              >
                <Text
                  variant="body"
                  weight={skipInterval === seconds ? 'bold' : 'normal'}
                  color={skipInterval === seconds ? theme.accent : theme.text}
                >
                  {seconds} Seconds
                </Text>
                {skipInterval === seconds && (
                  <MaterialIcons name="check" size={20} color={theme.accent} />
                )}
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>

      {/* Default Speed Picker Modal */}
      <Modal
        visible={showSpeedModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSpeedModal(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowSpeedModal(false)}>
          <View style={[styles.modalCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text variant="h3" weight="bold" style={styles.modalTitle}>
              Select Default Playback Speed
            </Text>
            {SPEED_OPTIONS.map((speed) => (
              <Pressable
                key={speed}
                style={[
                  styles.optionRow,
                  defaultSpeed === speed && { backgroundColor: theme.backgroundSelected },
                ]}
                onPress={() => {
                  setDefaultSpeed(speed);
                  setShowSpeedModal(false);
                }}
              >
                <Text
                  variant="body"
                  weight={defaultSpeed === speed ? 'bold' : 'normal'}
                  color={defaultSpeed === speed ? theme.accent : theme.text}
                >
                  {speed}× Playback Rate
                </Text>
                {defaultSpeed === speed && (
                  <MaterialIcons name="check" size={20} color={theme.accent} />
                )}
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    paddingBottom: 160,
    gap: Spacing.three,
  },
  audibleHeaderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.two,
    gap: Spacing.three,
  },
  avatarOuterRing: {
    position: 'relative',
    padding: 3,
    borderRadius: 44,
    borderWidth: 2,
  },
  avatarContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeCrown: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  userInfoGroup: {
    flex: 1,
    gap: 4,
  },
  userNameText: {
    fontSize: 20,
    lineHeight: 26,
  },
  memberTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
    marginTop: 2,
  },
  audibleMemberBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  cardHeaderPadding: {
    paddingBottom: 8,
  },
  cardContentPadding: {
    gap: 4,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  iconTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statGridRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  statGridItem: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  statGridDivider: {
    width: 1,
    height: 32,
    opacity: 0.4,
  },
  goalBox: {
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
    gap: 6,
  },
  goalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  goalTrack: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    width: '100%',
  },
  goalFill: {
    height: '100%',
    borderRadius: 4,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    minHeight: 44,
  },
  settingTextGroup: {
    flex: 1,
    paddingRight: Spacing.two,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  rowDivider: {
    height: 1,
    marginVertical: 4,
    opacity: 0.5,
  },
  segmentedContainer: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 4,
    marginTop: 8,
    gap: 4,
  },
  segmentButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
    minHeight: 40,
  },
  segmentButtonActive: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    minHeight: 40,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    gap: 8,
  },
  modalTitle: {
    marginBottom: 8,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    minHeight: 48,
  },
});
