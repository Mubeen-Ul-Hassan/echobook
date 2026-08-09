import {
  createAudioPlayer,
  setAudioModeAsync,
  requestNotificationPermissionsAsync,
} from 'expo-audio';
import type { AudioPlayer } from 'expo-audio';
import { Platform } from 'react-native';

let _player: AudioPlayer | null = null;

/**
 * Returns the global singleton AudioPlayer instance.
 * Creates it lazily on first access. Uses createAudioPlayer so the player
 * persists across component unmounts (needed for background playback).
 */
export function getAudioPlayer(): AudioPlayer {
  if (!_player) {
    _player = createAudioPlayer(null, { updateInterval: 250 });
    _player.shouldCorrectPitch = true;
  }
  return _player;
}

/**
 * Configures the global audio session for background playback and lock screen
 * controls. Must be called once at app startup before any playback begins.
 */
export async function initAudioSession(): Promise<void> {
  try {
    await setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionMode: 'doNotMix',
    });
  } catch (err) {
    console.warn('[AudioService] Failed to configure audio session:', err);
  }

  if (Platform.OS === 'android') {
    try {
      await requestNotificationPermissionsAsync();
    } catch {
      // Notification permission is best-effort on Android
    }
  }
}

/**
 * Subscribes to playback status updates to detect external audio focus loss
 * (e.g. headphone disconnection, phone calls, or audio interruptions).
 */
export function registerAudioInterruptionListener(
  onInterrupted: () => void
): () => void {
  const player = getAudioPlayer();
  let wasPlaying = false;

  const sub = player.addListener('playbackStatusUpdate', (status) => {
    if (status.isLoaded) {
      if (wasPlaying && !status.playing) {
        onInterrupted();
      }
      wasPlaying = status.playing;
    }
  });

  return () => sub.remove();
}

/**
 * Loads an audio file URI into the player, seeks to startPosition,
 * and optionally starts playback. Resolves when the audio is loaded and
 * the seek is complete.
 */
export async function loadAudio(
  uri: string,
  startPosition: number = 0,
  autoPlay: boolean = true,
): Promise<void> {
  const player = getAudioPlayer();

  return new Promise<void>((resolve) => {
    let settled = false;

    const sub = player.addListener('playbackStatusUpdate', async (status) => {
      if (settled) return;
      if (status.isLoaded) {
        settled = true;
        sub.remove();

        if (startPosition > 1) {
          try {
            await player.seekTo(startPosition);
          } catch {
            // Seek failure is non-fatal
          }
        }

        if (autoPlay) {
          player.play();
        }

        resolve();
      }
    });

    player.replace({ uri });

    // Safety timeout: resolve even if the isLoaded event never fires (e.g. buffering)
    setTimeout(() => {
      if (!settled) {
        settled = true;
        sub.remove();
        if (autoPlay && !player.playing) player.play();
        resolve();
      }
    }, 8000);
  });
}

/**
 * Tracks the URI that is currently loaded into the player.
 * Use this to avoid unnecessary file reloads when resuming the same book.
 */
let _currentUri: string | null = null;

export function getCurrentUri(): string | null {
  return _currentUri;
}

export function setCurrentUri(uri: string | null): void {
  _currentUri = uri;
}
