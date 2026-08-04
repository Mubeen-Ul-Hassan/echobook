import { create } from 'zustand';
import { AudiobookRecord, ChapterRecord } from '@/database/types';

interface PlaybackState {
  // Current Book, Chapter & Chapter list
  currentBook: AudiobookRecord | null;
  currentChapter: ChapterRecord | null;
  chapters: ChapterRecord[];

  // Playback parameters
  isPlaying: boolean;
  isLoaded: boolean;
  position: number;    // current playback position in seconds
  duration: number;    // total book duration in seconds
  speed: number;

  // Error state
  playbackError: string | null;
  setPlaybackError: (error: string | null) => void;

  // Player screen visibility (for mini-player show/hide logic)
  isPlayerVisible: boolean;
  setIsPlayerVisible: (visible: boolean) => void;

  // Sleep Timer
  sleepTimerDuration: number | null;
  sleepTimerRemaining: number | null;
  sleepTimerType: 'time' | 'chapter' | null;

  // Chapter Autoplay Countdown
  isAutoplayCountdown: boolean;
  autoplayCountdownRemaining: number; // 5 down to 0

  // Actions
  setCurrentBook: (book: AudiobookRecord | null) => void;
  setCurrentChapter: (chapter: ChapterRecord | null) => void;
  setChapters: (chapters: ChapterRecord[]) => void;
  setIsPlaying: (isPlaying: boolean) => void;
  setIsLoaded: (isLoaded: boolean) => void;
  setPosition: (position: number) => void;
  setDuration: (duration: number) => void;
  setSpeed: (speed: number) => void;

  // Sleep Timer Actions
  startSleepTimer: (duration: number, timerType: 'time' | 'chapter') => void;
  clearSleepTimer: () => void;
  tickSleepTimer: (onExpired?: () => void) => void;

  // Autoplay Countdown Actions
  startAutoplayCountdown: () => void;
  tickAutoplayCountdown: () => void;
  cancelAutoplayCountdown: () => void;

  // Reset all playback state
  resetPlayback: () => void;
}

export const usePlaybackStore = create<PlaybackState>((set, get) => ({
  currentBook: null,
  currentChapter: null,
  chapters: [],
  isPlaying: false,
  isLoaded: false,
  position: 0,
  duration: 0,
  speed: 1.0,
  playbackError: null,
  isPlayerVisible: false,

  setPlaybackError: (error) => set({ playbackError: error }),
  setIsPlayerVisible: (visible) => set({ isPlayerVisible: visible }),

  sleepTimerDuration: null,
  sleepTimerRemaining: null,
  sleepTimerType: null,

  isAutoplayCountdown: false,
  autoplayCountdownRemaining: 5,

  setCurrentBook: (book) =>
    set({
      currentBook: book,
      duration: book ? book.duration : 0,
    }),

  setCurrentChapter: (chapter) => set({ currentChapter: chapter }),

  setChapters: (chapters) => set({ chapters }),

  setIsPlaying: (isPlaying) => set({ isPlaying }),

  setIsLoaded: (isLoaded) => set({ isLoaded }),

  setPosition: (position) => set({ position }),

  setDuration: (duration) =>
    set((state) => ({
      duration,
      currentBook: state.currentBook ? { ...state.currentBook, duration } : null,
    })),

  setSpeed: (speed) => set({ speed }),

  startSleepTimer: (duration, timerType) =>
    set({
      sleepTimerDuration: duration,
      sleepTimerRemaining: timerType === 'time' ? duration : null,
      sleepTimerType: timerType,
    }),

  clearSleepTimer: () =>
    set({
      sleepTimerDuration: null,
      sleepTimerRemaining: null,
      sleepTimerType: null,
    }),

  tickSleepTimer: (onExpired?: () => void) => {
    const { sleepTimerRemaining, sleepTimerType, isPlaying } = get();
    if (!isPlaying || sleepTimerRemaining === null || sleepTimerType === 'chapter') return;

    if (sleepTimerRemaining <= 1) {
      set({
        sleepTimerDuration: null,
        sleepTimerRemaining: null,
        sleepTimerType: null,
      });
      onExpired?.();
    } else {
      set({ sleepTimerRemaining: sleepTimerRemaining - 1 });
    }
  },

  startAutoplayCountdown: () =>
    set({
      isAutoplayCountdown: true,
      autoplayCountdownRemaining: 5,
      isPlaying: false,
    }),

  tickAutoplayCountdown: () => {
    const { autoplayCountdownRemaining, isAutoplayCountdown } = get();
    if (!isAutoplayCountdown) return;

    if (autoplayCountdownRemaining <= 1) {
      set({
        isAutoplayCountdown: false,
        autoplayCountdownRemaining: 0,
      });
    } else {
      set({ autoplayCountdownRemaining: autoplayCountdownRemaining - 1 });
    }
  },

  cancelAutoplayCountdown: () =>
    set({
      isAutoplayCountdown: false,
      autoplayCountdownRemaining: 5,
    }),

  resetPlayback: () =>
    set({
      currentBook: null,
      currentChapter: null,
      chapters: [],
      isPlaying: false,
      isLoaded: false,
      position: 0,
      duration: 0,
      speed: 1.0,
      playbackError: null,
      sleepTimerDuration: null,
      sleepTimerRemaining: null,
      sleepTimerType: null,
      isAutoplayCountdown: false,
      autoplayCountdownRemaining: 5,
    }),
}));
