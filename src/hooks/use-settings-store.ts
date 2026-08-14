import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface UserSettings {
  autoPlayNext: boolean;
  skipInterval: number; // seconds: e.g. 10, 15, 30, 60
  defaultSpeed: number; // e.g. 0.8, 1.0, 1.25, 1.5, 1.75, 2.0
  pauseOnDisconnect: boolean;
  downloadWifiOnly: boolean;
  dailyReminder: boolean;
  finishAlerts: boolean;
  cacheSizeMB: number;
}

export interface UserSettingsState extends UserSettings {
  setAutoPlayNext: (val: boolean) => void;
  setSkipInterval: (val: number) => void;
  setDefaultSpeed: (val: number) => void;
  setPauseOnDisconnect: (val: boolean) => void;
  setDownloadWifiOnly: (val: boolean) => void;
  setDailyReminder: (val: boolean) => void;
  setFinishAlerts: (val: boolean) => void;
  setCacheSizeMB: (val: number) => void;
  updateSettings: (partial: Partial<UserSettings>) => void;
  resetSettings: () => void;
}

const DEFAULT_SETTINGS: UserSettings = {
  autoPlayNext: true,
  skipInterval: 30,
  defaultSpeed: 1.0,
  pauseOnDisconnect: true,
  downloadWifiOnly: true,
  dailyReminder: true,
  finishAlerts: true,
  cacheSizeMB: 14.2,
};

export const useSettingsStore = create<UserSettingsState>()(
  persist(
    (set) => ({
      ...DEFAULT_SETTINGS,

      setAutoPlayNext: (autoPlayNext) => set({ autoPlayNext }),
      setSkipInterval: (skipInterval) => set({ skipInterval }),
      setDefaultSpeed: (defaultSpeed) => set({ defaultSpeed }),
      setPauseOnDisconnect: (pauseOnDisconnect) => set({ pauseOnDisconnect }),
      setDownloadWifiOnly: (downloadWifiOnly) => set({ downloadWifiOnly }),
      setDailyReminder: (dailyReminder) => set({ dailyReminder }),
      setFinishAlerts: (finishAlerts) => set({ finishAlerts }),
      setCacheSizeMB: (cacheSizeMB) => set({ cacheSizeMB }),

      updateSettings: (partial) => set((state) => ({ ...state, ...partial })),

      resetSettings: () => set(DEFAULT_SETTINGS),
    }),
    {
      name: 'echobook-user-settings',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
