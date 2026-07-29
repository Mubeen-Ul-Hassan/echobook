import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Pressable,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
  Dimensions,
  Platform,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSQLiteContext } from 'expo-sqlite';
import { Image } from 'expo-image';
import { Plus, Search, Play, BookOpen, Clock, Music } from 'lucide-react-native';
import { useRouter, type Href } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';
import { dbService } from '@/database/services';
import { importService } from '@/features/import/services/import-service';
import { AudiobookRecord, PlaybackRecord } from '@/database/types';
import { Spacing } from '@/constants/theme';
import { usePlaybackStore } from '@/hooks/use-playback-store';

const { width } = Dimensions.get('window');
const COLUMN_WIDTH = (width - Spacing.four * 2 - Spacing.three) / 2;

export default function LibraryScreen() {
  const db = useSQLiteContext();
  const theme = useTheme();
  const router = useRouter();

  // Component State
  const [books, setBooks] = useState<AudiobookRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  
  // Playback state from store
  const {
    currentBook,
    isPlaying,
    setIsPlaying,
    setCurrentBook,
    setPosition,
    setCurrentChapter,
    setChapters,
    setSpeed,
  } = usePlaybackStore();
  const [recentPlayback, setRecentPlayback] = useState<(PlaybackRecord & { title: string; author: string | null; coverPath: string | null; duration: number }) | null>(null);

  // Load books from database
  const loadBooks = useCallback(async () => {
    try {
      const allBooks = await dbService.getAudiobooks(db);
      setBooks(allBooks);

      // Get the most recent playback
      const recents = await dbService.getRecentPlaybacks(db, 1);
      if (recents.length > 0) {
        // Fetch the corresponding book to get its full duration
        const fullBook = await dbService.getAudiobookById(db, recents[0].bookId);
        if (fullBook) {
          setRecentPlayback({
            ...recents[0],
            duration: fullBook.duration,
          });
        }
      } else {
        setRecentPlayback(null);
      }
    } catch (error) {
      console.error('Failed to load books:', error);
    }
  }, [db]);

  useEffect(() => {
    loadBooks();
  }, [loadBooks]);

  // Handle Import — native only (Android / iOS). Web cannot read large local M4B files.
  const handleImport = async () => {
    if (Platform.OS === 'web') {
      const message =
        'Import does not work in the browser.\n\n' +
        '1. In the terminal run: npx expo start\n' +
        '2. Open Expo Go on your Android phone\n' +
        '3. Scan the QR code (do not open localhost in Chrome)\n' +
        '4. Tap Import inside Expo Go';
      // window.alert works reliably on web; Alert.alert often does not
      if (typeof window !== 'undefined') {
        window.alert(message);
      } else {
        Alert.alert('Use Expo Go on your phone', message);
      }
      return;
    }

    setIsImporting(true);
    try {
      const imported = await importService.pickAndImportAudiobooks(db);
      if (imported.length > 0) {
        await loadBooks();
        Alert.alert(
          'Imported',
          `Added ${imported.length} audiobook${imported.length === 1 ? '' : 's'} to your library.`,
        );
      } else {
        Alert.alert(
          'Nothing imported',
          'No supported files were added. Pick a .m4b, .m4a, or .mp4 audiobook and try again.',
        );
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Something went wrong while importing. Please try again on Android.';
      Alert.alert('Import failed', message);
    } finally {
      setIsImporting(false);
    }
  };

  // Handle Continue Listening – loads the book and navigates straight to the player
  const handleContinueListening = async (bookId: string) => {
    try {
      const book = await dbService.getAudiobookById(db, bookId);
      if (book) {
        const [playback, bookChapters] = await Promise.all([
          dbService.getPlayback(db, bookId),
          dbService.getChaptersByBookId(db, bookId),
        ]);

        setCurrentBook(book);
        setChapters(bookChapters);

        if (playback) {
          setPosition(playback.position);
          const activeChapter =
            bookChapters.find((ch) => ch.id === playback.chapterId) || bookChapters[0] || null;
          setCurrentChapter(activeChapter);
          if (playback.speed) setSpeed(playback.speed);
        } else {
          setPosition(0);
          setCurrentChapter(bookChapters[0] || null);
          setSpeed(1.0);
        }

        router.push('/player');
      }
    } catch (error) {
      console.error('Failed to start playback:', error);
    }
  };

  // Filter books based on search
  const filteredBooks = books.filter((book) => {
    const query = searchQuery.toLowerCase();
    return (
      book.title.toLowerCase().includes(query) ||
      (book.author && book.author.toLowerCase().includes(query)) ||
      (book.genre && book.genre.toLowerCase().includes(query)) ||
      (book.series && book.series.toLowerCase().includes(query))
    );
  });

  // Formatting helpers
  const formatTimeRemaining = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0) {
      return `${h}h ${m}m remaining`;
    }
    return `${m}m remaining`;
  };

  const formatDuration = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0) {
      return `${h}h ${m}m`;
    }
    return `${m}m`;
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* Header */}
      <ThemedView style={styles.header}>
        <ThemedView>
          <ThemedText type="subtitle" style={styles.headerTitle}>
            Library
          </ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.headerSubtitle}>
            {books.length} {books.length === 1 ? 'audiobook' : 'audiobooks'} local
          </ThemedText>
        </ThemedView>
        <Pressable
          style={({ pressed }) => [
            styles.importButton,
            { backgroundColor: pressed ? theme.backgroundSelected : theme.backgroundElement },
            Platform.OS === 'web' && { opacity: 0.7 },
          ]}
          onPress={handleImport}
          disabled={isImporting}
          accessibilityRole="button"
          accessibilityLabel={
            Platform.OS === 'web'
              ? 'Import only available on phone via Expo Go'
              : isImporting
              ? 'Importing audiobook…'
              : 'Import audiobook from device'
          }
          accessibilityState={{ busy: isImporting, disabled: isImporting }}
        >
          {isImporting ? (
            <ActivityIndicator size="small" color={theme.accent} />
          ) : (
            <>
              <Plus size={18} color={theme.accent} />
              <ThemedText style={[styles.importButtonText, { color: theme.accent }]}>
                {Platform.OS === 'web' ? 'Phone only' : 'Import'}
              </ThemedText>
            </>
          )}
        </Pressable>
      </ThemedView>

      {Platform.OS === 'web' && (
        <ThemedView
          type="backgroundElement"
          style={styles.webNotice}
        >
          <ThemedText themeColor="textSecondary" style={styles.webNoticeText}>
            You are in the browser. Open this project in Expo Go on your Android phone to import and play audiobooks.
          </ThemedText>
        </ThemedView>
      )}

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Search Bar */}
        <ThemedView type="backgroundElement" style={styles.searchContainer}>
          <Search size={18} color={theme.textSecondary} style={styles.searchIcon} />
          <TextInput
            style={[styles.searchInput, { color: theme.text }]}
            placeholder="Search title, author, genre..."
            placeholderTextColor={theme.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            keyboardAppearance="dark"
          />
        </ThemedView>

        {/* Continue Listening Section */}
        {recentPlayback && !searchQuery && (
          <ThemedView style={styles.sectionContainer}>
            <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionTitle}>
              CONTINUE LISTENING
            </ThemedText>
            <Pressable
              onPress={() => handleContinueListening(recentPlayback.bookId)}
              style={({ pressed }) => [
                styles.continueCard,
                { backgroundColor: theme.backgroundElement, opacity: pressed ? 0.9 : 1 },
              ]}
              accessibilityRole="button"
              accessibilityLabel={`Continue listening to ${recentPlayback.title}. ${formatTimeRemaining(recentPlayback.duration - recentPlayback.position)} remaining.`}
            >
              {recentPlayback.coverPath ? (
                <Image source={{ uri: recentPlayback.coverPath }} style={styles.continueCover} />
              ) : (
                <View style={[styles.continueCoverPlaceholder, { backgroundColor: theme.backgroundSelected }]}>
                  <Music size={24} color={theme.textSecondary} />
                </View>
              )}
              
              <View style={styles.continueInfo}>
                <ThemedText numberOfLines={1} style={styles.continueBookTitle}>
                  {recentPlayback.title}
                </ThemedText>
                <ThemedText numberOfLines={1} themeColor="textSecondary" style={styles.continueAuthor}>
                  {recentPlayback.author || 'Unknown Author'}
                </ThemedText>
                
                {/* Progress Indicators */}
                <View style={styles.continueProgressRow}>
                  <Clock size={12} color={theme.textSecondary} style={{ marginRight: Spacing.one }} />
                  <ThemedText type="small" themeColor="textSecondary">
                    {formatTimeRemaining(recentPlayback.duration - recentPlayback.position)}
                  </ThemedText>
                </View>

                {/* Progress Bar */}
                <View style={[styles.progressBarBg, { backgroundColor: theme.backgroundSelected }]}>
                  <View
                    style={[
                      styles.progressBarFill,
                      {
                        backgroundColor: theme.accent,
                        width: `${Math.min(100, (recentPlayback.position / recentPlayback.duration) * 100)}%`,
                      },
                    ]}
                  />
                </View>
              </View>

              <Pressable
                style={[styles.continuePlayButton, { backgroundColor: theme.accent }]}
                onPress={() => handleContinueListening(recentPlayback.bookId)}
              >
                <Play size={20} color="#000000" fill="#000000" style={{ marginLeft: 2 }} />
              </Pressable>
            </Pressable>
          </ThemedView>
        )}

        {/* Recently Added Section (Horizontal shelf) */}
        {books.length > 0 && !searchQuery && (
          <ThemedView style={styles.sectionContainer}>
            <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionTitle}>
              RECENTLY ADDED
            </ThemedText>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.recentShelf}>
              {books.slice(0, 5).map((book) => (
                <Pressable
                  key={book.id}
                  style={({ pressed }) => [styles.recentCard, { opacity: pressed ? 0.8 : 1 }]}
                  onPress={() => router.push(`/book/${book.id}` as Href)}
                >
                  {book.coverPath ? (
                    <Image source={{ uri: book.coverPath }} style={styles.recentCover} />
                  ) : (
                    <View style={[styles.recentCoverPlaceholder, { backgroundColor: theme.backgroundElement }]}>
                      <Music size={24} color={theme.textSecondary} />
                    </View>
                  )}
                  <ThemedText numberOfLines={1} style={styles.recentBookTitle}>
                    {book.title}
                  </ThemedText>
                  <ThemedText numberOfLines={1} type="small" themeColor="textSecondary">
                    {book.author || 'Unknown Author'}
                  </ThemedText>
                </Pressable>
              ))}
            </ScrollView>
          </ThemedView>
        )}

        {/* All Books List */}
        <ThemedView style={styles.sectionContainer}>
          <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionTitle}>
            {searchQuery ? 'SEARCH RESULTS' : 'ALL AUDIOBOOKS'}
          </ThemedText>
          
          {filteredBooks.length === 0 ? (
            <View style={styles.emptyContainer}>
              <BookOpen size={48} color={theme.backgroundSelected} style={{ marginBottom: Spacing.two }} />
              <ThemedText themeColor="textSecondary" style={{ textAlign: 'center' }}>
                {searchQuery ? 'No audiobooks match your search.' : 'Your library is empty. Tap "+" above to import local M4B audiobooks.'}
              </ThemedText>
            </View>
          ) : (
            <View style={styles.grid}>
              {filteredBooks.map((book) => (
                <Pressable
                  key={book.id}
                  style={({ pressed }) => [
                    styles.gridCard,
                    { opacity: pressed ? 0.8 : 1 },
                  ]}
                  onPress={() => router.push(`/book/${book.id}` as Href)}
                  accessibilityRole="button"
                  accessibilityLabel={`${book.title}${book.author ? ` by ${book.author}` : ''}, ${formatDuration(book.duration)}`}
                >
                  {book.coverPath ? (
                    <Image source={{ uri: book.coverPath }} style={styles.gridCover} />
                  ) : (
                    <View style={[styles.gridCoverPlaceholder, { backgroundColor: theme.backgroundElement }]}>
                      <Music size={32} color={theme.textSecondary} />
                    </View>
                  )}
                  <View style={styles.gridInfo}>
                    <ThemedText numberOfLines={1} style={styles.gridBookTitle}>
                      {book.title}
                    </ThemedText>
                    <ThemedText numberOfLines={1} type="small" themeColor="textSecondary" style={styles.gridAuthor}>
                      {book.author || 'Unknown Author'}
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {formatDuration(book.duration)}
                    </ThemedText>
                  </View>
                </Pressable>
              ))}
            </View>
          )}
        </ThemedView>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
  },
  headerTitle: {
    fontWeight: '800',
  },
  headerSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  importButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.three,
    gap: Spacing.one,
  },
  importButtonText: {
    fontWeight: '700',
    fontSize: 14,
  },
  webNotice: {
    marginHorizontal: Spacing.four,
    marginBottom: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 2,
    borderRadius: Spacing.three,
  },
  webNoticeText: {
    fontSize: 13,
    lineHeight: 18,
  },
  scrollContent: {
    paddingBottom: Spacing.five,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: Spacing.four,
    marginBottom: Spacing.four,
    paddingHorizontal: Spacing.three,
    paddingVertical: Platform.OS === 'ios' ? Spacing.two : Spacing.one,
    borderRadius: Spacing.three,
  },
  searchIcon: {
    marginRight: Spacing.two,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 4,
  },
  sectionContainer: {
    marginBottom: Spacing.five,
    paddingHorizontal: Spacing.four,
  },
  sectionTitle: {
    letterSpacing: 1.5,
    marginBottom: Spacing.three,
    fontSize: 12,
  },
  continueCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.three,
    borderRadius: Spacing.four,
    position: 'relative',
  },
  continueCover: {
    width: 64,
    height: 64,
    borderRadius: Spacing.two,
  },
  continueCoverPlaceholder: {
    width: 64,
    height: 64,
    borderRadius: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueInfo: {
    flex: 1,
    marginLeft: Spacing.three,
    paddingRight: Spacing.six,
  },
  continueBookTitle: {
    fontWeight: '700',
    fontSize: 16,
  },
  continueAuthor: {
    fontSize: 14,
    marginTop: 1,
  },
  continueProgressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  progressBarBg: {
    height: 3,
    borderRadius: 2,
    marginTop: 8,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
  },
  continuePlayButton: {
    position: 'absolute',
    right: Spacing.three,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recentShelf: {
    gap: Spacing.three,
  },
  recentCard: {
    width: 100,
  },
  recentCover: {
    width: 100,
    height: 100,
    borderRadius: Spacing.three,
    marginBottom: Spacing.one,
  },
  recentCoverPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: Spacing.three,
    marginBottom: Spacing.one,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recentBookTitle: {
    fontWeight: '600',
    fontSize: 13,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
  },
  gridCard: {
    width: COLUMN_WIDTH,
    marginBottom: Spacing.three,
  },
  gridCover: {
    width: COLUMN_WIDTH,
    height: COLUMN_WIDTH,
    borderRadius: Spacing.four,
    marginBottom: Spacing.two,
  },
  gridCoverPlaceholder: {
    width: COLUMN_WIDTH,
    height: COLUMN_WIDTH,
    borderRadius: Spacing.four,
    marginBottom: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridInfo: {
    paddingHorizontal: 2,
  },
  gridBookTitle: {
    fontWeight: '700',
    fontSize: 14,
  },
  gridAuthor: {
    marginTop: 1,
    marginBottom: 2,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.six,
    paddingHorizontal: Spacing.four,
  },
});
