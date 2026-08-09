import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSQLiteContext } from 'expo-sqlite';
import { useRouter } from 'expo-router';

import { useTheme } from '@/hooks/use-theme';
import { usePlaybackStore } from '@/hooks/use-playback-store';
import { usePlayerContext } from '@/features/player/components/playback-provider';
import { dbService } from '@/database/services';
import { BookmarkRecord, ChapterRecord } from '@/database/types';

import { PlayerHeader } from '@/features/player/components/PlayerHeader';
import { PlayerCoverArt } from '@/features/player/components/PlayerCoverArt';
import { PlayerSeekBar } from '@/features/player/components/PlayerSeekBar';
import { PlayerControls } from '@/features/player/components/PlayerControls';
import { SpeedSheet } from '@/features/player/components/SpeedSheet';
import { SleepTimerSheet } from '@/features/player/components/SleepTimerSheet';
import { ChapterSelectionSheet } from '@/features/player/components/ChapterSelectionSheet';
import { BookmarkSheet } from '@/features/player/components/BookmarkSheet';
import { DeviceSelectionSheet } from '@/features/player/components/DeviceSelectionSheet';
import { safeGoBack } from '@/utils/navigation';

export default function PlayerScreen() {
  const router = useRouter();
  const theme = useTheme();
  const db = useSQLiteContext();
  const insets = useSafeAreaInsets();

  // Reactive state from Zustand store
  const currentBook = usePlaybackStore((s) => s.currentBook);
  const currentChapter = usePlaybackStore((s) => s.currentChapter);
  const chapters = usePlaybackStore((s) => s.chapters);
  const position = usePlaybackStore((s) => s.position);
  const duration = usePlaybackStore((s) => s.duration);
  const isPlaying = usePlaybackStore((s) => s.isPlaying);
  const isLoaded = usePlaybackStore((s) => s.isLoaded);
  const speed = usePlaybackStore((s) => s.speed);
  const sleepTimerType = usePlaybackStore((s) => s.sleepTimerType);
  const sleepTimerDuration = usePlaybackStore((s) => s.sleepTimerDuration);
  const sleepTimerRemaining = usePlaybackStore((s) => s.sleepTimerRemaining);

  const formatSleepText = (secs: number | null): string | undefined => {
    if (!secs || secs <= 0) return undefined;
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    if (m > 0) return `${m}m`;
    return `${s}s`;
  };

  const sleepTimerRemainingText = sleepTimerType === 'chapter' ? 'End' : formatSleepText(sleepTimerRemaining);

  const startSleepTimer = usePlaybackStore((s) => s.startSleepTimer);
  const clearSleepTimer = usePlaybackStore((s) => s.clearSleepTimer);
  const setIsPlayerVisible = usePlaybackStore((s) => s.setIsPlayerVisible);

  useEffect(() => {
    setIsPlayerVisible(true);
    return () => setIsPlayerVisible(false);
  }, [setIsPlayerVisible]);

  // Player action methods from Context
  const {
    togglePlayPause,
    seekTo,
    skipForward,
    skipBackward,
    nextChapter,
    prevChapter,
    jumpToChapter,
    setSpeed,
  } = usePlayerContext();

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
    [db, currentBook, currentChapter, position]
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

  if (!currentBook) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <PlayerHeader
          title="No Audiobook Selected"
          onClose={() => safeGoBack(router)}
          onOpenDeviceSheet={() => setShowDeviceSheet(true)}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <PlayerHeader
        title={currentBook.title}
        chapterTitle={currentChapter?.title}
        onClose={() => safeGoBack(router)}
        onOpenDeviceSheet={() => setShowDeviceSheet(true)}
      />

      {/* Cover Art */}
      <PlayerCoverArt
        coverPath={currentBook.coverPath}
        title={currentBook.title}
        isPlaying={isPlaying}
      />

      {/* Seek Bar */}
      <PlayerSeekBar
        position={position}
        duration={duration}
        currentChapter={currentChapter}
        onSeek={seekTo}
      />

      {/* Main Controls */}
      <PlayerControls
        isPlaying={isPlaying}
        isLoaded={isLoaded}
        speed={speed}
        hasSleepTimer={!!sleepTimerType}
        sleepTimerRemainingText={sleepTimerRemainingText}
        bookmarkCount={bookmarks.length}
        onTogglePlayPause={togglePlayPause}
        onSkipBack={() => skipBackward(30)}
        onSkipForward={() => skipForward(30)}
        onPrevChapter={prevChapter}
        onNextChapter={nextChapter}
        onOpenSpeedSheet={() => setShowSpeedSheet(true)}
        onOpenSleepSheet={() => setShowSleepSheet(true)}
        onOpenChapterSheet={() => setShowChapterSheet(true)}
        onOpenBookmarkSheet={() => setShowBookmarkSheet(true)}
      />

      {/* Bottom Sheets */}
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
        currentPosition={position}
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'space-between',
  },
});
