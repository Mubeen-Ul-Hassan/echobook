import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
} from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { useAudioPlayerStatus } from 'expo-audio';

import { usePlaybackStore } from '@/hooks/use-playback-store';
import { dbService } from '@/database/services';
import { importService } from '@/features/import/services/import-service';
import { AudiobookRecord, ChapterRecord } from '@/database/types';
import { autoSegmentChapters } from '@/features/import/services/m4b-parser';
import {
  getAudioPlayer,
  initAudioSession,
  loadAudio,
  getCurrentUri,
  setCurrentUri,
} from '../services/audio-service';

// ---------------------------------------------------------------------------
// Context – exposes playback controls to the entire app
// ---------------------------------------------------------------------------

interface PlayerContextValue {
  /** Load a book and start playback from the given position. */
  startBook: (
    book: AudiobookRecord,
    chapters: ChapterRecord[],
    startPosition: number,
    autoPlay?: boolean,
  ) => Promise<void>;
  play: () => void;
  pause: () => void;
  togglePlayPause: () => void;
  seekTo: (seconds: number) => Promise<void>;
  skipForward: (seconds?: number) => Promise<void>;
  skipBackward: (seconds?: number) => Promise<void>;
  nextChapter: () => Promise<void>;
  prevChapter: () => Promise<void>;
  jumpToChapter: (chapter: ChapterRecord) => Promise<void>;
  setSpeed: (speed: number) => void;
}

const PlayerContext = createContext<PlayerContextValue | null>(null);

export function usePlayerContext(): PlayerContextValue {
  const ctx = useContext(PlayerContext);
  if (!ctx) {
    throw new Error('usePlayerContext must be used within PlaybackProvider');
  }
  return ctx;
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function PlaybackProvider({ children }: { children: React.ReactNode }) {
  const db = useSQLiteContext();
  const player = getAudioPlayer();
  const status = useAudioPlayerStatus(player);

  // Zustand store accessors
  const currentBook = usePlaybackStore((s) => s.currentBook);
  const currentChapter = usePlaybackStore((s) => s.currentChapter);
  const chapters = usePlaybackStore((s) => s.chapters);
  const speed = usePlaybackStore((s) => s.speed);
  const sleepTimerType = usePlaybackStore((s) => s.sleepTimerType);

  const setIsPlaying = usePlaybackStore((s) => s.setIsPlaying);
  const setIsLoaded = usePlaybackStore((s) => s.setIsLoaded);
  const setPosition = usePlaybackStore((s) => s.setPosition);
  const setDuration = usePlaybackStore((s) => s.setDuration);
  const setCurrentChapter = usePlaybackStore((s) => s.setCurrentChapter);
  const clearSleepTimer = usePlaybackStore((s) => s.clearSleepTimer);
  const tickSleepTimer = usePlaybackStore((s) => s.tickSleepTimer);
  const startAutoplayCountdown = usePlaybackStore((s) => s.startAutoplayCountdown);
  const isAutoplayCountdown = usePlaybackStore((s) => s.isAutoplayCountdown);
  const setPlaybackError = usePlaybackStore((s) => s.setPlaybackError);
  const setCurrentBook = usePlaybackStore((s) => s.setCurrentBook);
  const setChapters = usePlaybackStore((s) => s.setChapters);
  const setSpeed = usePlaybackStore((s) => s.setSpeed);

  // Ref guards to prevent side-effect loops
  const saveTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastSavedPositionRef = useRef<number>(0);
  const prevPlayingRef = useRef<boolean>(false);
  const isLoadingNewBookRef = useRef<boolean>(false);

  // ---------------------------------------------------------------------------
  // 1. Initialise audio session on mount and restore last session
  // ---------------------------------------------------------------------------
  useEffect(() => {
    initAudioSession().catch(console.warn);
  }, []);

  // Restore last played book on app launch
  useEffect(() => {
    async function restoreLastSession() {
      try {
        const recents = await dbService.getRecentPlaybacks(db, 1);
        if (recents.length > 0) {
          const lastPlayback = recents[0];
          const lastBook = await dbService.getAudiobookById(db, lastPlayback.bookId);
          if (lastBook) {
            const bookChapters = await dbService.getChaptersByBookId(db, lastBook.id);

            setCurrentBook(lastBook);
            setChapters(bookChapters);
            setDuration(lastBook.duration);

            setPosition(lastPlayback.position);

            const activeCh = bookChapters.find(
              (ch) =>
                lastPlayback.position >= ch.startTime &&
                lastPlayback.position < ch.endTime
            );
            if (activeCh) setCurrentChapter(activeCh);
            else if (bookChapters.length > 0) setCurrentChapter(bookChapters[0]);

            setCurrentUri(lastBook.audioPath);
            await loadAudio(lastBook.audioPath, lastPlayback.position, false);

            // Re-apply playback speed to the native audio player once loaded
            if (lastPlayback.speed) {
              player.setPlaybackRate(lastPlayback.speed);
            }
          }
        }
      } catch (err) {
        console.warn('[PlaybackProvider] Failed to restore last session:', err);
      }
    }
    restoreLastSession();
  }, [db]);

  // ---------------------------------------------------------------------------
  // 2. Sync player status → Zustand store + handle errors
  // ---------------------------------------------------------------------------
  useEffect(() => {
    setIsLoaded(status.isLoaded);
    setIsPlaying(status.playing);

    if (status.isLoaded) {
      setPosition(status.currentTime);

      const realDuration = status.duration;
      if (realDuration && realDuration > 0) {
        const activeBook = usePlaybackStore.getState().currentBook;
        const activeChapters = usePlaybackStore.getState().chapters;

        const isBrokenChapters =
          activeChapters.length === 0 ||
          activeChapters.every((c) => c.endTime <= c.startTime || c.endTime <= 0) ||
          (activeChapters.length === 1 && activeChapters[0].endTime < realDuration - 1);

        if (
          usePlaybackStore.getState().duration !== realDuration ||
          (activeBook && activeBook.duration <= 0) ||
          isBrokenChapters
        ) {
          setDuration(realDuration);

          if (activeBook) {
            dbService.updateAudiobookDuration(db, activeBook.id, realDuration).catch(console.warn);

            if (isBrokenChapters || activeBook.duration <= 0) {
              const segmented = autoSegmentChapters(realDuration);
              const newChapters: ChapterRecord[] = segmented.map((ch, idx) => ({
                id: `${activeBook.id}_ch_${idx}`,
                bookId: activeBook.id,
                title: ch.title,
                startTime: ch.startTime,
                endTime: ch.endTime,
                duration: ch.endTime - ch.startTime,
                order: idx,
              }));

              dbService.replaceBookChapters(db, activeBook.id, newChapters).then(() => {
                setChapters(newChapters);
                const curPos = status.currentTime;
                const matchCh = newChapters.find((c) => curPos >= c.startTime && curPos < c.endTime) ?? newChapters[0];
                if (matchCh) setCurrentChapter(matchCh);
              }).catch(console.warn);
            }
          }
        }
      }
    }

    // Surface playback errors to the UI
    if (status.error) {
      const msg = status.error.includes('format')
        ? 'Unsupported audio format. Try importing a different file.'
        : status.error.includes('corrupt') || status.error.includes('decode')
        ? 'The audio file appears to be corrupted.'
        : `Playback error: ${status.error}`;
      setPlaybackError(msg);
    }
  }, [
    status.isLoaded,
    status.playing,
    status.currentTime,
    status.duration,
    status.error,
    db,
    setIsLoaded,
    setIsPlaying,
    setPosition,
    setDuration,
    setChapters,
    setCurrentChapter,
    setPlaybackError,
  ]);

  // iOS: if media services reset (daemon crash), attempt to recover automatically
  useEffect(() => {
    if ((status as { mediaServicesDidReset?: boolean }).mediaServicesDidReset) {
      const { currentBook: book, position: pos } = usePlaybackStore.getState();
      if (book) {
        loadAudio(book.audioPath, pos, false).catch(console.warn);
      }
    }
  }, [(status as { mediaServicesDidReset?: boolean }).mediaServicesDidReset]);

  // ---------------------------------------------------------------------------
  // 3. Chapter boundary detection
  //    When currentTime crosses into a new chapter, update currentChapter.
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!currentBook || chapters.length === 0 || !status.isLoaded) return;

    const t = status.currentTime;
    const activeChapter = chapters.find(
      (ch) => t >= ch.startTime && t < ch.endTime,
    );

    if (activeChapter && activeChapter.id !== currentChapter?.id) {
      setCurrentChapter(activeChapter);

      // Update lock-screen now-playing chapter name
      player.updateLockScreenMetadata({
        title: activeChapter.title,
        artist: currentBook.author ?? undefined,
        albumTitle: currentBook.title,
        artworkUrl: currentBook.coverPath ?? undefined,
      });
    }
  }, [status.currentTime, chapters, currentBook, currentChapter?.id, setCurrentChapter, player]);

  // ---------------------------------------------------------------------------
  // 4. Chapter end: trigger autoplay countdown (Milestone 5 feature)
  //    When audio reaches the end of the current chapter's endTime we pause
  //    briefly and start the countdown so the user can cancel/skip.
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (
      !status.isLoaded ||
      !currentChapter ||
      isAutoplayCountdown ||
      isLoadingNewBookRef.current ||
      currentChapter.endTime <= currentChapter.startTime ||
      currentChapter.endTime <= 0
    ) return;

    const isAtChapterEnd =
      status.currentTime > 0 &&
      status.currentTime >= currentChapter.endTime - 0.5 &&
      currentChapter.endTime < (currentBook?.duration ?? Infinity);

    if (isAtChapterEnd && status.playing) {
      player.pause();
      startAutoplayCountdown();
    }
  }, [
    status.currentTime,
    status.playing,
    status.isLoaded,
    currentChapter,
    currentBook,
    isAutoplayCountdown,
    player,
    startAutoplayCountdown,
  ]);

  // Sleep timer countdown: tick every second while playing
  useEffect(() => {
    if (!status.playing) return;
    const id = setInterval(() => {
      tickSleepTimer(() => {
        player.pause();
      });
    }, 1000);
    return () => clearInterval(id);
  }, [status.playing, tickSleepTimer, player]);

  // Sleep-timer type=chapter: pause when chapter changes
  useEffect(() => {
    if (sleepTimerType === 'chapter' && status.playing) {
      player.pause();
      clearSleepTimer();
    }
  }, [currentChapter?.id, sleepTimerType, status.playing, player, clearSleepTimer]);

  // ---------------------------------------------------------------------------
  // 5. Auto-save playback position to SQLite
  //    - Every 5 s while playing
  //    - Immediately when playback transitions playing → paused
  // ---------------------------------------------------------------------------
  const savePosition = useCallback(
    async (position: number) => {
      if (!currentBook) return;
      try {
        await dbService.savePlayback(db, {
          bookId: currentBook.id,
          chapterId: currentChapter?.id ?? null,
          position,
          speed,
          lastPlayed: new Date().toISOString(),
          completed: 0,
        });
        lastSavedPositionRef.current = position;
      } catch (err) {
        console.warn('[PlaybackProvider] Failed to save position:', err);
      }
    },
    [db, currentBook, currentChapter, speed],
  );

  // Save every 5 s while playing
  useEffect(() => {
    if (status.playing) {
      saveTimerRef.current = setInterval(() => {
        savePosition(player.currentTime);
      }, 5000);
    } else {
      if (saveTimerRef.current) {
        clearInterval(saveTimerRef.current);
        saveTimerRef.current = null;
      }
    }

    return () => {
      if (saveTimerRef.current) {
        clearInterval(saveTimerRef.current);
        saveTimerRef.current = null;
      }
    };
  }, [status.playing, savePosition, player]);

  // Save immediately when transitioning from playing → paused
  useEffect(() => {
    if (prevPlayingRef.current && !status.playing && status.isLoaded) {
      savePosition(player.currentTime);
    }
    prevPlayingRef.current = status.playing;
  }, [status.playing, status.isLoaded, savePosition, player]);

  // ---------------------------------------------------------------------------
  // 6. Save on app background
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'background' || state === 'inactive') {
        savePosition(player.currentTime);
      }
    });
    return () => sub.remove();
  }, [savePosition, player]);

  // ---------------------------------------------------------------------------
  // Player control methods exposed through context
  // ---------------------------------------------------------------------------

  const startBook = useCallback(
    async (
      book: AudiobookRecord,
      bookChapters: ChapterRecord[],
      startPosition: number,
      autoPlay: boolean = true,
    ): Promise<void> => {
      const uri = book.audioPath;
      isLoadingNewBookRef.current = true;

      // If the same file is already loaded, just seek instead of reloading
      if (getCurrentUri() === uri && player.isLoaded) {
        if (Math.abs(player.currentTime - startPosition) > 2) {
          await player.seekTo(startPosition);
        }
        if (autoPlay && !player.playing) {
          player.play();
        }
        isLoadingNewBookRef.current = false;
      } else {
        setCurrentUri(uri);
        await loadAudio(uri, startPosition, autoPlay);
        isLoadingNewBookRef.current = false;
      }

      // Update store
      setCurrentBook(book);
      setChapters(bookChapters);

      // Asynchronously repair missing cover art or chapters if needed
      importService.repairOrRefreshBookMetadata(db, book.id).then(({ audiobook, chapters: refreshedChapters }) => {
        if (audiobook) setCurrentBook(audiobook);
        if (refreshedChapters.length > 0) setChapters(refreshedChapters);
      }).catch(console.warn);

      // Update playback rate
      const savedSpeed = usePlaybackStore.getState().speed;
      player.setPlaybackRate(savedSpeed);

      // Activate lock screen controls
      const activeChapter = bookChapters.find(
        (ch) => startPosition >= ch.startTime && startPosition < ch.endTime,
      ) ?? bookChapters[0];

      player.setActiveForLockScreen(
        true,
        {
          title: activeChapter?.title ?? book.title,
          artist: book.author ?? undefined,
          albumTitle: book.title,
          artworkUrl: book.coverPath ?? undefined,
        },
        { showSeekForward: true, showSeekBackward: true },
      );
    },
    [player],
  );

  const play = useCallback(() => {
    player.play();
    if (currentBook) {
      player.setActiveForLockScreen(
        true,
        {
          title: currentChapter?.title ?? currentBook.title,
          artist: currentBook.author ?? undefined,
          albumTitle: currentBook.title,
          artworkUrl: currentBook.coverPath ?? undefined,
        },
        { showSeekForward: true, showSeekBackward: true },
      );
    }
  }, [player, currentBook, currentChapter]);

  const pause = useCallback(() => {
    player.pause();
  }, [player]);

  const togglePlayPause = useCallback(() => {
    if (player.playing) {
      pause();
    } else {
      play();
    }
  }, [player, play, pause]);

  const seekTo = useCallback(
    async (seconds: number): Promise<void> => {
      await player.seekTo(seconds);
    },
    [player],
  );

  const skipForward = useCallback(
    async (seconds: number = 30): Promise<void> => {
      const target = Math.min(
        player.currentTime + seconds,
        currentBook?.duration ?? player.currentTime + seconds,
      );
      await player.seekTo(target);
    },
    [player, currentBook],
  );

  const skipBackward = useCallback(
    async (seconds: number = 30): Promise<void> => {
      const target = Math.max(0, player.currentTime - seconds);
      await player.seekTo(target);
    },
    [player],
  );

  const nextChapter = useCallback(async (): Promise<void> => {
    if (!currentChapter || chapters.length === 0) return;
    const idx = chapters.findIndex((ch) => ch.id === currentChapter.id);
    const next = chapters[idx + 1];
    if (next) {
      await player.seekTo(next.startTime);
      setCurrentChapter(next);
      if (!player.playing) player.play();
    }
  }, [player, currentChapter, chapters, setCurrentChapter]);

  const prevChapter = useCallback(async (): Promise<void> => {
    if (!currentChapter || chapters.length === 0) return;
    const idx = chapters.findIndex((ch) => ch.id === currentChapter.id);
    // If more than 3 s into chapter → restart chapter; else go to previous
    if (player.currentTime - currentChapter.startTime > 3) {
      await player.seekTo(currentChapter.startTime);
    } else {
      const prev = chapters[idx - 1];
      if (prev) {
        await player.seekTo(prev.startTime);
        setCurrentChapter(prev);
      }
    }
    if (!player.playing) player.play();
  }, [player, currentChapter, chapters, setCurrentChapter]);

  const jumpToChapter = useCallback(
    async (chapter: ChapterRecord): Promise<void> => {
      await player.seekTo(chapter.startTime);
      setCurrentChapter(chapter);
      if (!player.playing) player.play();
    },
    [player, setCurrentChapter],
  );

  const setSpeedFn = useCallback(
    (newSpeed: number) => {
      player.setPlaybackRate(newSpeed);
      usePlaybackStore.getState().setSpeed(newSpeed);
    },
    [player],
  );

  const value: PlayerContextValue = {
    startBook,
    play,
    pause,
    togglePlayPause,
    seekTo,
    skipForward,
    skipBackward,
    nextChapter,
    prevChapter,
    jumpToChapter,
    setSpeed: setSpeedFn,
  };

  return (
    <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>
  );
}
