/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#0F172A',
    background: '#F8F9FA',
    backgroundElement: '#FFFFFF',
    backgroundSelected: '#F1F3F5',
    textSecondary: '#64748B',
    accent: '#F7991C', // Audible Signature Amber Gold
    accentHover: '#E08816',
    secondary: '#00A572',
    border: '#E5E7EB',
    card: '#FFFFFF',
    success: '#10B981',
  },
  dark: {
    text: '#E5E1E4',
    background: '#131315', // Stitch Deep Charcoal Base
    backgroundElement: '#201F21', // Stitch Surface Container
    backgroundSelected: '#2A2A2C', // Stitch Container High Surface
    textSecondary: '#DAC2AE',
    accent: '#F7991C', // Stitch Primary Amber Gold
    accentHover: '#E08816',
    secondary: '#4EDEA3', // Stitch Secondary Mint/Teal Accent
    border: '#2E2E34',
    card: '#201F21',
    success: '#4EDEA3',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
