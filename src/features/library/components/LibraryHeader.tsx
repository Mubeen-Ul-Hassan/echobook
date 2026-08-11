import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { MaterialIcons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';

interface LibraryHeaderProps {
  searchQuery?: string;
  onSearchChange?: (text: string) => void;
  isImporting: boolean;
  onImport: () => void;
  showSearchBar?: boolean;
}

export function LibraryHeader({
  searchQuery = '',
  onSearchChange,
  isImporting,
  onImport,
  showSearchBar = false,
}: LibraryHeaderProps) {
  const theme = useTheme();

  return (
    <View style={[styles.container, !showSearchBar && styles.containerCompact]}>
      {/* Top Title Row */}
      <View style={[styles.titleRow, !showSearchBar && styles.titleRowCompact]}>
        <View>
          <ThemedText style={styles.brandTitle}>EchoBook</ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.brandSubtitle}>
            Your Personal Audiobook Library
          </ThemedText>
        </View>

        <Pressable
          onPress={onImport}
          disabled={isImporting}
          style={({ pressed }) => [
            styles.importBtn,
            { backgroundColor: theme.accent, opacity: pressed || isImporting ? 0.75 : 1 },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Import audiobook M4B file"
        >
          {isImporting ? (
            <ActivityIndicator size="small" color="#000" />
          ) : (
            <>
              <MaterialIcons name="add" size={20} color="#000" />
              <ThemedText style={styles.importBtnText}>Import</ThemedText>
            </>
          )}
        </Pressable>
      </View>

      {/* Search Input Bar (only shown if showSearchBar is true) */}
      {showSearchBar && onSearchChange ? (
        <View style={[styles.searchBar, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
          <MaterialIcons name="search" size={20} color={theme.textSecondary} />
          <TextInput
            value={searchQuery}
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
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.three,
  },
  containerCompact: {
    paddingBottom: Spacing.two,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  titleRowCompact: {
    marginBottom: 0,
  },
  brandTitle: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  brandSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  importBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  importBtnText: {
    color: '#000',
    fontWeight: '700',
    fontSize: 14,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    padding: 0,
  },
});
