/**
 * Safe Navigation Helpers for EchoBook
 * - Prevents duplicate screen pushes and modal instances caused by rapid double-tapping.
 * - Safely handles back navigation without throwing unhandled 'GO_BACK' errors when no history exists.
 * - Synchronously locks player visibility state so MiniPlayer never pops up in the background during navigation.
 */
import { usePlaybackStore } from '@/hooks/use-playback-store';

let lastPlayerNavigationTimestamp = 0;

export function navigateToPlayer(router: any, currentPathname?: string) {
  const now = Date.now();
  // Drop navigation if user double-tapped within 600ms or if player is already open
  if (now - lastPlayerNavigationTimestamp < 600 || currentPathname === '/player') {
    return;
  }
  lastPlayerNavigationTimestamp = now;
  // Mark player as visible immediately so MiniPlayer never flashes in the background
  usePlaybackStore.getState().setIsPlayerVisible(true);
  router.navigate('/player');
}

export function safeGoBack(router: any) {
  if (router.canGoBack?.()) {
    router.back();
  } else {
    router.replace('/');
  }
}
