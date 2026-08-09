import React from 'react';
import { StyleSheet, View, Pressable, FlatList } from 'react-native';
import Animated, { SlideInDown, SlideOutDown, Easing } from 'react-native-reanimated';
import { MaterialIcons } from '@expo/vector-icons';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { ChapterRecord } from '@/database/types';

interface ChapterSelectionSheetProps {
  visible: boolean;
  chapters: ChapterRecord[];
  currentChapterId?: string;
  onSelectChapter: (chapter: ChapterRecord) => void;
  onClose: () => void;
  bottomPadding?: number;
}

function formatTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  if (h > 0) return `${h}:${pad(m)}:${pad(sec)}`;
  return `${m}:${pad(sec)}`;
}

export function ChapterSelectionSheet({
  visible,
  chapters,
  currentChapterId,
  onSelectChapter,
  onClose,
  bottomPadding = 24,
}: ChapterSelectionSheetProps) {
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
        <MaterialIcons name="format-list-bulleted" size={22} color={theme.accent} />
        <ThemedText style={styles.sheetTitle}>Chapters ({chapters.length})</ThemedText>
      </View>

      <FlatList
        data={chapters}
        keyExtractor={(item) => item.id}
        style={styles.chapterList}
        renderItem={({ item, index }) => {
          const isSelected = item.id === currentChapterId;
          const duration = item.endTime - item.startTime;

          return (
            <Pressable
              onPress={() => {
                onSelectChapter(item);
                onClose();
              }}
              style={({ pressed }) => [
                styles.chapterRow,
                {
                  backgroundColor: isSelected ? theme.backgroundSelected : 'transparent',
                  opacity: pressed ? 0.75 : 1,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel={`Chapter ${index + 1}: ${item.title}`}
              accessibilityState={{ selected: isSelected }}
            >
              <View style={styles.chapterInfo}>
                <ThemedText
                  style={[
                    styles.chapterTitle,
                    isSelected ? { color: theme.accent, fontWeight: '700' } : {},
                  ]}
                  numberOfLines={1}
                >
                  {item.title}
                </ThemedText>
                <ThemedText themeColor="textSecondary" style={styles.chapterMeta}>
                  {formatTime(item.startTime)} • {formatTime(duration)}
                </ThemedText>
              </View>
              {isSelected && (
                <MaterialIcons name="volume-up" size={20} color={theme.accent} />
              )}
            </Pressable>
          );
        }}
      />

      <Pressable
        onPress={onClose}
        style={[styles.sheetCloseBtn, { backgroundColor: theme.backgroundSelected }]}
        accessibilityRole="button"
        accessibilityLabel="Close chapter list sheet"
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
    maxHeight: '75%',
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
  chapterList: {
    marginBottom: 16,
  },
  chapterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 4,
  },
  chapterInfo: {
    flex: 1,
    marginRight: 12,
  },
  chapterTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  chapterMeta: {
    fontSize: 12,
    marginTop: 2,
  },
  sheetCloseBtn: {
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
