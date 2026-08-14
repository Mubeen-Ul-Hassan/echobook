import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSQLiteContext } from 'expo-sqlite';
import { useRouter } from 'expo-router';

import { usePlaybackStore } from '@/hooks/use-playback-store';
import { usePlayerContext } from '@/features/player/components/playback-provider';
import { dbService } from '@/database/services';
import { BookmarkRecord } from '@/database/types';
import { safeGoBack } from '@/utils/navigation';

import PlayerScreen from '@/features/player/components/PlayerScreen';
import { SpeedSheet } from '@/features/player/components/SpeedSheet';
import { SleepTimerSheet } from '@/features/player/components/SleepTimerSheet';
import { ChapterSelectionSheet } from '@/features/player/components/ChapterSelectionSheet';
import { BookmarkSheet } from '@/features/player/components/BookmarkSheet';
import { DeviceSelectionSheet } from '@/features/player/components/DeviceSelectionSheet';

export default function PlayerScreenRoute() {
  const router = useRouter();
  const db = useSQLiteContext();
  const insets = useSafeAreaInsets();

  // Reactive state from Zustand store (fine-grained selectors)
  const currentBook = usePlaybackStore((s) => s.currentBook);
  const currentChapter = usePlaybackStore((s) => s.currentChapter);
  const chapters = usePlaybackStore((s) => s.chapters);
  const speed = usePlaybackStore((s) => s.speed);
  const sleepTimerType = usePlaybackStore((s) => s.sleepTimerType);
  const sleepTimerDuration = usePlaybackStore((s) => s.sleepTimerDuration);

  const startSleepTimer = usePlaybackStore((s) => s.startSleepTimer);
  const clearSleepTimer = usePlaybackStore((s) => s.clearSleepTimer);
  const setIsPlayerVisible = usePlaybackStore((s) => s.setIsPlayerVisible);

  useEffect(() => {
    setIsPlayerVisible(true);
    return () => setIsPlayerVisible(false);
  }, [setIsPlayerVisible]);

  // Player action methods from Context
  const { seekTo, jumpToChapter, setSpeed } = usePlayerContext();

  const [bookmarks, setBookmarks] = useState<BookmarkRecord[]>([]);
  const [showSpeedSheet, setShowSpeedSheet] = useState(false);
  const [showSleepSheet, setShowSleepSheet] = useState(false);
  const [showChapterSheet, setShowChapterSheet] = useState(false);
  const [showBookmarkSheet, setShowBookmarkSheet] = useState(false);
  const [showDeviceSheet, setShowDeviceSheet] = useState(false);

  // Load bookmarks for current book
  useEffect(() => {
    if (!currentBook) return;
    dbService.getBookmarksByBookId(db, currentBook.id).then(setBookmarks).catch(console.warn);
  }, [db, currentBook]);

  const handleAddBookmark = useCallback(
    async (note?: string) => {
      if (!currentBook) return;
      const position = usePlaybackStore.getState().position;
      const newBm: BookmarkRecord = {
        id: 'bm_' + Date.now().toString(36),
        bookId: currentBook.id,
        chapterId: currentChapter?.id ?? null,
        position,
        note: note ?? null,
        createdAt: new Date().toISOString(),
      };
      await dbService.insertBookmark(db, newBm);
      setBookmarks((prev) => [newBm, ...prev]);
    },
    [db, currentBook, currentChapter]
  );

  const handleDeleteBookmark = useCallback(
    async (id: string) => {
      await dbService.deleteBookmark(db, id);
      setBookmarks((prev) => prev.filter((b) => b.id !== id));
    },
    [db]
  );

  const handleSelectBookmark = useCallback(
    (bmPosition: number) => {
      seekTo(bmPosition);
    },
    [seekTo]
  );

  // Position is read lazily for BookmarkSheet when opened
  const currentPosition = usePlaybackStore((s) => s.position);

  return (
    <View style={styles.container}>
      <PlayerScreen
        onClose={() => safeGoBack(router)}
        onOpenSpeedSheet={() => setShowSpeedSheet(true)}
        onOpenSleepSheet={() => setShowSleepSheet(true)}
        onOpenChapterSheet={() => setShowChapterSheet(true)}
        onOpenBookmarkSheet={() => setShowBookmarkSheet(true)}
      />

      <SpeedSheet
        visible={showSpeedSheet}
        speed={speed}
        onSelectSpeed={setSpeed}
        onClose={() => setShowSpeedSheet(false)}
        bottomPadding={insets.bottom + 16}
      />

      <SleepTimerSheet
        visible={showSleepSheet}
        sleepTimerType={sleepTimerType}
        sleepTimerDuration={sleepTimerDuration}
        onStartTimer={startSleepTimer}
        onClearTimer={clearSleepTimer}
        onClose={() => setShowSleepSheet(false)}
        bottomPadding={insets.bottom + 16}
      />

      <ChapterSelectionSheet
        visible={showChapterSheet}
        chapters={chapters}
        currentChapterId={currentChapter?.id}
        onSelectChapter={jumpToChapter}
        onClose={() => setShowChapterSheet(false)}
        bottomPadding={insets.bottom + 16}
      />

      <BookmarkSheet
        visible={showBookmarkSheet}
        bookmarks={bookmarks}
        currentPosition={currentPosition}
        onSelectBookmark={handleSelectBookmark}
        onAddBookmark={handleAddBookmark}
        onDeleteBookmark={handleDeleteBookmark}
        onClose={() => setShowBookmarkSheet(false)}
        bottomPadding={insets.bottom + 16}
      />

      <DeviceSelectionSheet
        visible={showDeviceSheet}
        onClose={() => setShowDeviceSheet(false)}
        bottomPadding={insets.bottom + 16}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
