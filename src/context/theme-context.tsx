import React, { createContext, useContext, useState } from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';

export type ThemeMode = 'system' | 'light' | 'dark';

interface ThemeContextType {
  themeMode: ThemeMode;
  colorScheme: 'light' | 'dark';
  setThemeMode: (mode: ThemeMode) => void;
  toggleDarkMode: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  themeMode: 'system',
  colorScheme: 'light',
  setThemeMode: () => {},
  toggleDarkMode: () => {},
});

export function ThemeModeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useRNColorScheme();
  const [themeMode, setThemeMode] = useState<ThemeMode>('system');

  const resolvedScheme: 'light' | 'dark' =
    themeMode === 'system'
      ? systemScheme === 'dark'
        ? 'dark'
        : 'light'
      : themeMode;

  const toggleDarkMode = () => {
    setThemeMode((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  return (
    <ThemeContext.Provider
      value={{
        themeMode,
        colorScheme: resolvedScheme,
        setThemeMode,
        toggleDarkMode,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useThemeContext() {
  return useContext(ThemeContext);
}
