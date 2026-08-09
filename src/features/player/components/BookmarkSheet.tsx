import React, { useState } from 'react';
import { StyleSheet, View, Pressable, FlatList, TextInput } from 'react-native';
import Animated, { SlideInDown, SlideOutDown, Easing } from 'react-native-reanimated';
import { MaterialIcons } from '@expo/vector-icons';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { BookmarkRecord } from '@/database/types';

interface BookmarkSheetProps {
  visible: boolean;
  bookmarks: BookmarkRecord[];
  currentPosition: number;
  onSelectBookmark: (position: number) => void;
  onAddBookmark: (note?: string) => void;
  onDeleteBookmark: (id: string) => void;
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

export function BookmarkSheet({
  visible,
  bookmarks,
  currentPosition,
  onSelectBookmark,
  onAddBookmark,
  onDeleteBookmark,
  onClose,
  bottomPadding = 24,
}: BookmarkSheetProps) {
  const theme = useTheme();
  const [noteInput, setNoteInput] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  if (!visible) return null;

  const handleSaveBookmark = () => {
    onAddBookmark(noteInput.trim() || undefined);
    setNoteInput('');
    setIsAdding(false);
  };

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
        <MaterialIcons name="bookmark" size={22} color={theme.accent} />
        <ThemedText style={styles.sheetTitle}>Bookmarks ({bookmarks.length})</ThemedText>
      </View>

      {/* Add Bookmark Quick Action Bar */}
      {!isAdding ? (
        <Pressable
          onPress={() => setIsAdding(true)}
          style={[styles.addBookmarkBtn, { backgroundColor: theme.accent }]}
          accessibilityRole="button"
          accessibilityLabel="Add bookmark at current position"
        >
          <MaterialIcons name="add" size={20} color="#000" />
          <ThemedText style={styles.addBookmarkBtnText}>
            Add Bookmark at {formatTime(currentPosition)}
          </ThemedText>
        </Pressable>
      ) : (
        <View style={styles.noteInputContainer}>
          <TextInput
            value={noteInput}
            onChangeText={setNoteInput}
            placeholder="Add optional note..."
            placeholderTextColor={theme.textSecondary}
            style={[styles.noteInput, { color: theme.text, borderColor: theme.border }]}
            autoFocus
          />
          <View style={styles.noteActionRow}>
            <Pressable
              onPress={() => setIsAdding(false)}
              style={[styles.smallActionBtn, { backgroundColor: theme.backgroundSelected }]}
            >
              <ThemedText themeColor="textSecondary">Cancel</ThemedText>
            </Pressable>
            <Pressable
              onPress={handleSaveBookmark}
              style={[styles.smallActionBtn, { backgroundColor: theme.accent }]}
            >
              <ThemedText style={{ color: '#000', fontWeight: '700' }}>Save</ThemedText>
            </Pressable>
          </View>
        </View>
      )}

      {/* Bookmarks List */}
      <FlatList
        data={bookmarks}
        keyExtractor={(item) => item.id}
        style={styles.bookmarkList}
        renderItem={({ item }) => (
          <View
            style={[styles.bookmarkRow, { backgroundColor: theme.backgroundSelected }]}
          >
            <Pressable
              onPress={() => {
                onSelectBookmark(item.position);
                onClose();
              }}
              style={styles.bookmarkMainInfo}
            >
              <ThemedText style={styles.bookmarkTime}>
                {formatTime(item.position)}
              </ThemedText>
              {item.note ? (
                <ThemedText themeColor="textSecondary" style={styles.bookmarkNote} numberOfLines={1}>
                  {item.note}
                </ThemedText>
              ) : null}
            </Pressable>

            <Pressable
              onPress={() => onDeleteBookmark(item.id)}
              style={styles.deleteBtn}
              accessibilityRole="button"
              accessibilityLabel="Delete bookmark"
            >
              <MaterialIcons name="delete-outline" size={20} color="#FF6B6B" />
            </Pressable>
          </View>
        )}
      />

      <Pressable
        onPress={onClose}
        style={[styles.sheetCloseBtn, { backgroundColor: theme.backgroundSelected }]}
        accessibilityRole="button"
        accessibilityLabel="Close bookmark sheet"
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
  addBookmarkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 14,
    marginBottom: 16,
  },
  addBookmarkBtnText: {
    color: '#000',
    fontWeight: '700',
    fontSize: 14,
  },
  noteInputContainer: {
    marginBottom: 16,
  },
  noteInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    marginBottom: 8,
  },
  noteActionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  smallActionBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
  },
  bookmarkList: {
    marginBottom: 16,
  },
  bookmarkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    marginBottom: 6,
  },
  bookmarkMainInfo: {
    flex: 1,
    marginRight: 12,
  },
  bookmarkTime: {
    fontSize: 15,
    fontWeight: '700',
  },
  bookmarkNote: {
    fontSize: 12,
    marginTop: 2,
  },
  deleteBtn: {
    padding: 6,
  },
  sheetCloseBtn: {
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
