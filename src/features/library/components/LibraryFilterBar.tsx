import React from 'react';
import { StyleSheet, View, Pressable, ScrollView, TextInput } from 'react-native';
import MaskedView from '@react-native-masked-view/masked-view';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { Spacing, Fonts } from '@/constants/theme';

export type CategoryFilter =
  | 'all'
  | 'sci_fi'
  | 'classics'
  | 'in_progress'
  | 'completed'
  | 'fiction'
  | 'non_fiction';

export type ViewMode = 'grid' | 'list';
export type SortOption = 'recent' | 'title' | 'author' | 'duration';

interface LibraryFilterBarProps {
  searchQuery?: string;
  onSearchChange?: (text: string) => void;
  activeFilter: CategoryFilter;
  onFilterChange: (filter: CategoryFilter) => void;
  viewMode?: ViewMode;
  onViewModeChange?: (mode: ViewMode) => void;
  sortBy?: SortOption;
  onSortChange?: (sort: SortOption) => void;
}

const FILTER_CHIPS: { label: string; value: CategoryFilter }[] = [
  { label: 'All', value: 'all' },
  { label: 'Sci-Fi', value: 'sci_fi' },
  { label: 'Classics', value: 'classics' },
  { label: 'In Progress', value: 'in_progress' },
  { label: 'Completed', value: 'completed' },
  { label: 'Fiction', value: 'fiction' },
  { label: 'Non-Fiction', value: 'non_fiction' },
];

export function LibraryFilterBar({
  searchQuery,
  onSearchChange,
  activeFilter,
  onFilterChange,
}: LibraryFilterBarProps) {
  const theme = useTheme();

  return (
    <View style={styles.container}>
      {/* 1. Library Section Header */}
      <View style={styles.headerRow}>
        <ThemedText style={[styles.sectionTitle, { fontFamily: Fonts.extraBold }]}>
          Library
        </ThemedText>
      </View>

      {/* 2. Search Bar */}
      {onSearchChange !== undefined && (
        <View style={[styles.searchBar, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
          <MaterialIcons name="search" size={20} color={theme.textSecondary} />
          <TextInput
            value={searchQuery || ''}
            onChangeText={onSearchChange}
            placeholder="Search by title, author, or genre..."
            placeholderTextColor={theme.textSecondary}
            style={[styles.searchInput, { color: theme.text, fontFamily: Fonts.medium }]}
          />
          {searchQuery ? (
            <Pressable onPress={() => onSearchChange('')} hitSlop={8}>
              <MaterialIcons name="close" size={18} color={theme.textSecondary} />
            </Pressable>
          ) : null}
        </View>
      )}

      {/* 3. Short Filter Buttons — 6-stop smooth masked gradient fade for perfect edge dissipation */}
      <View style={styles.chipsViewport}>
        <MaskedView
          style={styles.maskedView}
          maskElement={
            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.3)', '#000000', '#000000', 'rgba(0,0,0,0.3)', 'transparent']}
              locations={[0, 0.03, 0.08, 0.92, 0.97, 1]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
          }
        >
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
            style={styles.chipsScrollView}
          >
            {FILTER_CHIPS.map((chip) => {
              const isActive = activeFilter === chip.value;
              const activeTextColor = '#0F172A';

              return (
                <Pressable
                  key={chip.value}
                  onPress={() => onFilterChange(chip.value)}
                  hitSlop={{ top: 6, bottom: 6, left: 2, right: 2 }}
                  style={({ pressed }) => [
                    styles.chip,
                    {
                      backgroundColor: isActive ? theme.accent : theme.backgroundElement,
                      borderColor: isActive ? theme.accent : theme.border,
                      transform: [{ scale: pressed ? 0.96 : 1 }],
                      opacity: pressed ? 0.9 : 1,
                    },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={`Filter by ${chip.label}`}
                  accessibilityState={{ selected: isActive }}
                >
                  <ThemedText
                    style={[
                      styles.chipText,
                      {
                        color: isActive ? activeTextColor : theme.text,
                        fontFamily: isActive ? Fonts.bold : Fonts.medium,
                      },
                    ]}
                  >
                    {chip.label}
                  </ThemedText>
                </Pressable>
              );
            })}
          </ScrollView>
        </MaskedView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: Spacing.four,
    marginBottom: Spacing.three,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 20,
    letterSpacing: -0.4,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    height: 44,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 14,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    padding: 0,
  },
  chipsViewport: {
    marginHorizontal: -Spacing.four,
  },
  maskedView: {
    width: '100%',
    height: 42,
  },
  chipsScrollView: {
    flexGrow: 0,
  },
  scrollContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: Spacing.four,
    paddingVertical: 2,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    height: 36,
    borderRadius: 20,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 13,
    letterSpacing: -0.1,
  },
});



