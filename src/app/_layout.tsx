import { useEffect, Suspense } from 'react';
import { Stack } from 'expo-router';
import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { SQLiteProvider } from 'expo-sqlite';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { migrateDbIfNeeded } from '@/database/schema';
import { PlaybackProvider } from '@/features/player/components/playback-provider';
import { MiniPlayer } from '@/components/mini-player';
import { ErrorBoundary } from '@/components/error-boundary';
import { ThemeModeProvider } from '@/context/theme-context';
import { useColorScheme } from '@/hooks/use-color-scheme';

import { useFonts } from 'expo-font';

SplashScreen.preventAutoHideAsync();

import { PlaybackErrorBanner } from '@/components/playback-error-banner';

function RootContent() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Suspense fallback={null}>
        <SQLiteProvider databaseName="echobook.db" onInit={migrateDbIfNeeded}>
          {/* PlaybackProvider must be inside SQLiteProvider so it can persist playback */}
          <PlaybackProvider>
            <PlaybackErrorBanner />
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="book/[id]" options={{ headerShown: false }} />
              <Stack.Screen
                name="player"
                options={{
                  presentation: 'modal',
                  animation: 'slide_from_bottom',
                  gestureEnabled: true,
                  gestureDirection: 'vertical',
                }}
              />
            </Stack>
            {/* Mini-player floating bar (shown on all non-player screens) */}
            <MiniPlayer />
          </PlaybackProvider>
        </SQLiteProvider>
      </Suspense>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Montserrat_400Regular: require('@/assets/fonts/Montserrat-Regular.ttf'),
    Montserrat_500Medium: require('@/assets/fonts/Montserrat-Medium.ttf'),
    Montserrat_600SemiBold: require('@/assets/fonts/Montserrat-SemiBold.ttf'),
    Montserrat_700Bold: require('@/assets/fonts/Montserrat-Bold.ttf'),
    Montserrat_800ExtraBold: require('@/assets/fonts/Montserrat-ExtraBold.ttf'),
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <ThemeModeProvider>
          <RootContent />
        </ThemeModeProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}

