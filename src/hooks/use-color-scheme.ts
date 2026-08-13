import { useThemeContext } from '@/context/theme-context';

export function useColorScheme() {
  const context = useThemeContext();
  return context ? context.colorScheme : 'light';
}

