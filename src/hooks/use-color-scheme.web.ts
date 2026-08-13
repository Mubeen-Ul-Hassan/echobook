import { useEffect, useState } from 'react';
import { useThemeContext } from '@/context/theme-context';

/**
 * To support static rendering, this value needs to be re-calculated on the client side for web
 */
export function useColorScheme() {
  const [hasHydrated, setHasHydrated] = useState(false);
  const context = useThemeContext();

  useEffect(() => {
    setHasHydrated(true);
  }, []);

  if (hasHydrated && context) {
    return context.colorScheme;
  }

  return 'light';
}

