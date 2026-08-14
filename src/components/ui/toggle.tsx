import React from 'react';
import {
  Pressable,
  PressableProps,
  StyleSheet,
  ViewStyle,
  StyleProp,
} from 'react-native';
import { useTheme } from '@/hooks/use-theme';
import { Text } from '@/components/ui/text';

export interface ToggleProps extends Omit<PressableProps, 'style'> {
  pressed: boolean;
  onPressedChange?: (pressed: boolean) => void;
  variant?: 'default' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
  accessibilityLabel?: string;
}

export function Toggle({
  pressed,
  onPressedChange,
  variant = 'default',
  size = 'md',
  disabled = false,
  style,
  children,
  accessibilityLabel,
  onPress,
  ...props
}: ToggleProps) {
  const theme = useTheme();

  const handlePress = (e: any) => {
    if (disabled) return;
    if (onPress) onPress(e);
    if (onPressedChange) onPressedChange(!pressed);
  };

  const getContainerStyle = (isPressedState: boolean): ViewStyle => {
    if (pressed) {
      return {
        backgroundColor: theme.accent,
        borderColor: theme.accent,
      };
    }

    if (variant === 'outline') {
      return {
        backgroundColor: isPressedState ? theme.backgroundSelected : 'transparent',
        borderColor: theme.border,
        borderWidth: 1,
      };
    }

    return {
      backgroundColor: isPressedState ? theme.backgroundSelected : theme.backgroundElement,
      borderColor: 'transparent',
      borderWidth: 0,
    };
  };

  const getSizeStyle = (): ViewStyle => {
    switch (size) {
      case 'sm':
        return {
          minHeight: 44,
          minWidth: 44,
          paddingHorizontal: 12,
          paddingVertical: 6,
          borderRadius: 22,
        };
      case 'lg':
        return {
          minHeight: 52,
          minWidth: 52,
          paddingHorizontal: 20,
          paddingVertical: 12,
          borderRadius: 26,
        };
      case 'md':
      default:
        return {
          minHeight: 44,
          minWidth: 44,
          paddingHorizontal: 16,
          paddingVertical: 10,
          borderRadius: 22,
        };
    }
  };

  return (
    <Pressable
      disabled={disabled}
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityState={{ selected: pressed, disabled }}
      accessibilityLabel={accessibilityLabel}
      style={({ pressed: isPressedState }) => [
        styles.base,
        getSizeStyle(),
        getContainerStyle(isPressedState),
        disabled && styles.disabled,
        style,
      ]}
      {...props}
    >
      {typeof children === 'string' || typeof children === 'number' ? (
        <Text
          variant={size === 'sm' ? 'caption' : 'body'}
          weight="semiBold"
          color={pressed ? '#000000' : theme.text}
        >
          {children}
        </Text>
      ) : (
        children
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  disabled: {
    opacity: 0.5,
  },
});

export default Toggle;
