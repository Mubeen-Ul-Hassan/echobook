import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

export function BottomTabBar({ state, navigation }: any) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const activeColor = theme.accent;
  const inactiveColor = theme.textSecondary;

  const tabs = [
    {
      name: 'index',
      label: 'Home',
      iconType: 'community' as const,
      activeIcon: 'home' as const,
      inactiveIcon: 'home-outline' as const,
    },
    {
      name: 'library',
      label: 'Library',
      iconType: 'material' as const,
      activeIcon: 'library-books' as const,
      inactiveIcon: 'library-books' as const,
    },
    {
      name: 'profile',
      label: 'Profile',
      iconType: 'community' as const,
      activeIcon: 'account-circle' as const,
      inactiveIcon: 'account-circle-outline' as const,
    },
  ];

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.backgroundElement,
          borderTopColor: theme.border,
          paddingBottom: Math.max(insets.bottom, 8),
        },
      ]}
    >
      <View style={styles.content}>
        {tabs.map((tab) => {
          const routeIndex = state.routes.findIndex((r: { name: string }) => r.name === tab.name);
          const isFocused = state.index === routeIndex;

          const onPress = () => {
            const route = state.routes.find((r: { name: string }) => r.name === tab.name);
            const event = navigation.emit({
              type: 'tabPress',
              target: route?.key ?? tab.name,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(tab.name);
            }
          };

          const iconName = isFocused ? tab.activeIcon : tab.inactiveIcon;
          const color = isFocused ? activeColor : inactiveColor;

          return (
            <Pressable
              key={tab.name}
              onPress={onPress}
              style={({ pressed }) => [
                styles.tabItem,
                { opacity: pressed ? 0.7 : 1 },
              ]}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              accessibilityLabel={tab.label}
            >
              {tab.iconType === 'material' ? (
                <MaterialIcons name={iconName as any} size={30} color={color} />
              ) : (
                <MaterialCommunityIcons name={iconName as any} size={30} color={color} />
              )}
              <ThemedText
                style={[
                  styles.tabLabel,
                  {
                    color,
                    fontWeight: isFocused ? '600' : '400',
                  },
                ]}
              >
                {tab.label}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderTopWidth: 1,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
  },
  content: {
    flexDirection: 'row',
    height: 64,
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
    gap: 0,
  },
  tabLabel: {
    fontSize: 11,
    letterSpacing: -0.1,
  },
});
