import React from 'react';
import { StyleSheet, View, Pressable, ScrollView } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { Spacing } from '@/constants/theme';

export type CategoryFilter = 'all' | 'in_progress' | 'completed';
export type ViewMode = 'grid' | 'list';
export type SortOption = 'recent' | 'title' | 'author' | 'duration';

interface LibraryFilterBarProps {
  activeFilter: CategoryFilter;
  onFilterChange: (filter: CategoryFilter) => void;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  sortBy: SortOption;
  onSortChange: (sort: SortOption) => void;
}

const FILTER_CHIPS: { label: string; value: CategoryFilter }[] = [
  { label: 'All Books', value: 'all' },
  { label: 'In Progress', value: 'in_progress' },
  { label: 'Completed', value: 'completed' },
];

const NEXT_SORT: Record<SortOption, SortOption> = {
  recent: 'title',
  title: 'author',
  author: 'duration',
  duration: 'recent',
};

const SORT_LABELS: Record<SortOption, string> = {
  recent: 'Recent',
  title: 'Title',
  author: 'Author',
  duration: 'Length',
};

export function LibraryFilterBar({
  activeFilter,
  onFilterChange,
  viewMode,
  onViewModeChange,
  sortBy,
  onSortChange,
}: LibraryFilterBarProps) {
  const theme = useTheme();

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
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

      {/* Sort Chip & View Mode Toggle */}
      <View style={styles.rightControls}>
        <Pressable
          onPress={() => onSortChange(NEXT_SORT[sortBy])}
          style={({ pressed }) => [
            styles.sortChip,
            { backgroundColor: theme.backgroundElement, borderColor: theme.border, opacity: pressed ? 0.8 : 1 },
          ]}
          accessibilityRole="button"
          accessibilityLabel={`Sorted by ${SORT_LABELS[sortBy]}. Tap to change sort order`}
        >
          <MaterialIcons name="sort" size={16} color={theme.accent} />
          <ThemedText style={styles.sortText}>{SORT_LABELS[sortBy]}</ThemedText>
        </Pressable>

        <View style={[styles.toggleContainer, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
          <Pressable
            onPress={() => onViewModeChange('grid')}
            style={[
              styles.toggleBtn,
              viewMode === 'grid' && { backgroundColor: theme.backgroundSelected },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Grid view"
          >
            <MaterialIcons
              name="grid-view"
              size={18}
              color={viewMode === 'grid' ? theme.accent : theme.textSecondary}
            />
          </Pressable>

          <Pressable
            onPress={() => onViewModeChange('list')}
            style={[
              styles.toggleBtn,
              viewMode === 'list' && { backgroundColor: theme.backgroundSelected },
            ]}
            accessibilityRole="button"
            accessibilityLabel="List view"
          >
            <MaterialIcons
              name="view-list"
              size={18}
              color={viewMode === 'list' ? theme.accent : theme.textSecondary}
            />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    marginBottom: Spacing.three,
  },
  scrollContent: {
    gap: 8,
    paddingRight: 12,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  rightControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sortChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 12,
    borderWidth: 1,
  },
  sortText: {
    fontSize: 12,
    fontWeight: '700',
  },
  toggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 2,
    borderRadius: 12,
    borderWidth: 1,
  },
  toggleBtn: {
    padding: 6,
    borderRadius: 10,
  },
});
