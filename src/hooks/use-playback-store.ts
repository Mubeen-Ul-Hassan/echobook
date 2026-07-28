import { create } from 'zustand';
import { AudiobookRecord, ChapterRecord } from '@/database/types';

interface PlaybackState {
  // Current Book & Chapter
  currentBook: AudiobookRecord | null;
  currentChapter: ChapterRecord | null;
  
  // Playback parameters
  isPlaying: boolean;
  position: number; // in seconds
  duration: number; // overall duration of book or current chapter? (usually total duration is stored in book, chapter duration in chapter)
  speed: number;
  
  // Sleep Timer
  sleepTimerDuration: number | null; // initial seconds
  sleepTimerRemaining: number | null; // seconds remaining
  sleepTimerType: 'time' | 'chapter' | null;

  // Chapter Autoplay Countdown
  isAutoplayCountdown: boolean;
  autoplayCountdownRemaining: number; // 5 down to 0

  // Actions
  setCurrentBook: (book: AudiobookRecord | null) => void;
  setCurrentChapter: (chapter: ChapterRecord | null) => void;
  setIsPlaying: (isPlaying: boolean) => void;
  setPosition: (position: number) => void;
  setSpeed: (speed: number) => void;
  
  // Sleep Timer Actions
  startSleepTimer: (duration: number, timerType: 'time' | 'chapter') => void;
  clearSleepTimer: () => void;
  tickSleepTimer: () => void;

  // Autoplay Countdown Actions
  startAutoplayCountdown: () => void;
  tickAutoplayCountdown: () => void;
  cancelAutoplayCountdown: () => void;
  
  // Reset all playback
  resetPlayback: () => void;
}

export const usePlaybackStore = create<PlaybackState>((set, get) => ({
  currentBook: null,
  currentChapter: null,
  isPlaying: false,
  position: 0,
  duration: 0,
  speed: 1.0,
  
  sleepTimerDuration: null,
  sleepTimerRemaining: null,
  sleepTimerType: null,

  isAutoplayCountdown: false,
  autoplayCountdownRemaining: 5,

  setCurrentBook: (book) => set({ 
    currentBook: book, 
    duration: book ? book.duration : 0 
  }),
  
  setCurrentChapter: (chapter) => set({ 
    currentChapter: chapter 
  }),
  
  setIsPlaying: (isPlaying) => set({ isPlaying }),
  
  setPosition: (position) => set({ position }),
  
  setSpeed: (speed) => set({ speed }),

  startSleepTimer: (duration, timerType) => set({
    sleepTimerDuration: duration,
    sleepTimerRemaining: duration,
    sleepTimerType: timerType,
  }),

  clearSleepTimer: () => set({
    sleepTimerDuration: null,
    sleepTimerRemaining: null,
    sleepTimerType: null,
  }),

  tickSleepTimer: () => {
    const { sleepTimerRemaining, sleepTimerType, isPlaying } = get();
    if (!isPlaying || sleepTimerRemaining === null || sleepTimerType === 'chapter') return;
    
    if (sleepTimerRemaining <= 1) {
      set({
        isPlaying: false,
        sleepTimerDuration: null,
        sleepTimerRemaining: null,
        sleepTimerType: null,
      });
    } else {
      set({ sleepTimerRemaining: sleepTimerRemaining - 1 });
    }
  },

  startAutoplayCountdown: () => set({
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
      // The calling component or service should trigger the next chapter play
    } else {
      set({ autoplayCountdownRemaining: autoplayCountdownRemaining - 1 });
    }
  },

  cancelAutoplayCountdown: () => set({
    isAutoplayCountdown: false,
    autoplayCountdownRemaining: 5,
  }),

  resetPlayback: () => set({
    currentBook: null,
    currentChapter: null,
    isPlaying: false,
    position: 0,
    duration: 0,
    speed: 1.0,
    sleepTimerDuration: null,
    sleepTimerRemaining: null,
    sleepTimerType: null,
    isAutoplayCountdown: false,
    autoplayCountdownRemaining: 5,
  }),
}));
