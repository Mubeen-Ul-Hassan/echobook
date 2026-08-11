import React from 'react';
import { StyleSheet, View, Pressable, ScrollView, TextInput } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { Spacing } from '@/constants/theme';

const EDGE_FADE_WIDTH = 36;
/** Soft smoke steps from solid → transparent (hex alpha suffixes). */
const SMOKE_ALPHAS = ['E6', 'B8', '8A', '5C', '2E', '00'] as const;

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

function EdgeSmoke({
  color,
  side,
}: {
  color: string;
  side: 'left' | 'right';
}) {
  const alphas = side === 'left' ? SMOKE_ALPHAS : [...SMOKE_ALPHAS].reverse();

  return (
    <View
      pointerEvents="none"
      style={[styles.edgeFade, side === 'left' ? styles.edgeFadeLeft : styles.edgeFadeRight]}
    >
      {alphas.map((alpha, index) => (
        <View
          key={`${side}-${alpha}-${index}`}
          style={[styles.smokeStrip, { backgroundColor: `${color}${alpha}` }]}
        />
      ))}
    </View>
  );
}

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
        <ThemedText style={styles.sectionTitle}>Library</ThemedText>
      </View>

      {/* 2. Relocated Search Bar */}
      {onSearchChange !== undefined && (
        <View style={[styles.searchBar, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
          <MaterialIcons name="search" size={20} color={theme.textSecondary} />
          <TextInput
            value={searchQuery || ''}
            onChangeText={onSearchChange}
            placeholder="Search by title, author, or genre..."
            placeholderTextColor={theme.textSecondary}
            style={[styles.searchInput, { color: theme.text }]}
          />
          {searchQuery ? (
            <Pressable onPress={() => onSearchChange('')} hitSlop={8}>
              <MaterialIcons name="close" size={18} color={theme.textSecondary} />
            </Pressable>
          ) : null}
        </View>
      )}

      {/* 3. Short Filter Buttons — smoke fades on both ends for a slider look */}
      <View style={styles.chipsViewport}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          style={styles.chipsScrollView}
        >
          {FILTER_CHIPS.map((chip) => {
            const isActive = activeFilter === chip.value;
            return (
              <Pressable
                key={chip.value}
                onPress={() => onFilterChange(chip.value)}
                style={({ pressed }) => [
                  styles.chip,
                  {
                    backgroundColor: isActive ? theme.accent : theme.backgroundElement,
                    borderColor: isActive ? theme.accent : theme.border,
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
                accessibilityRole="button"
                accessibilityLabel={`Filter by ${chip.label}`}
                accessibilityState={{ selected: isActive }}
              >
                <ThemedText
                  style={[
                    styles.chipText,
                    isActive ? { color: '#000', fontWeight: '700' } : {},
                  ]}
                >
                  {chip.label}
                </ThemedText>
              </Pressable>
            );
          })}
        </ScrollView>

        <EdgeSmoke color={theme.background} side="left" />
        <EdgeSmoke color={theme.background} side="right" />
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
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    padding: 0,
  },
  chipsViewport: {
    marginHorizontal: -Spacing.four,
    position: 'relative',
  },
  chipsScrollView: {
    flexGrow: 0,
  },
  scrollContent: {
    gap: 8,
    paddingHorizontal: Spacing.four,
  },
  edgeFade: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: EDGE_FADE_WIDTH,
    zIndex: 1,
    flexDirection: 'row',
  },
  edgeFadeLeft: {
    left: 0,
  },
  edgeFadeRight: {
    right: 0,
  },
  smokeStrip: {
    flex: 1,
    height: '100%',
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 16,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
