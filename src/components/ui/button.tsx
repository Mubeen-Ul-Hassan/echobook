import React from 'react';
import {
  Pressable,
  PressableProps,
  StyleSheet,
  ViewStyle,
  TextStyle,
  StyleProp,
} from 'react-native';
import { useTheme } from '@/hooks/use-theme';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';

export type ButtonVariant = 'default' | 'secondary' | 'ghost' | 'icon' | 'outline';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';

export interface ButtonProps extends Omit<PressableProps, 'style'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  className?: string;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}

export function Button({
  variant = 'default',
  size = 'md',
  disabled = false,
  className,
  style,
  children,
  accessibilityRole = 'button',
  accessibilityLabel,
  ...props
}: ButtonProps) {
  const theme = useTheme();

  const getVariantContainerStyle = (pressed: boolean): ViewStyle => {
    switch (variant) {
      case 'default':
        return {
          backgroundColor: pressed ? theme.accentHover : theme.accent,
          borderWidth: 0,
        };
      case 'secondary':
        return {
          backgroundColor: pressed ? theme.backgroundSelected : theme.backgroundElement,
          borderWidth: 0,
        };
      case 'outline':
        return {
          backgroundColor: pressed ? theme.backgroundSelected : 'transparent',
          borderWidth: 1,
          borderColor: theme.border,
        };
      case 'ghost':
      case 'icon':
        return {
          backgroundColor: pressed ? theme.backgroundSelected : 'transparent',
          borderWidth: 0,
        };
      default:
        return {
          backgroundColor: theme.accent,
        };
    }
  };

  const getSizeContainerStyle = (): ViewStyle => {
    switch (size) {
      case 'sm':
        return {
          minHeight: 44,
          minWidth: 44,
          paddingHorizontal: 12,
          paddingVertical: 8,
          borderRadius: 16,
        };
      case 'lg':
        return {
          minHeight: 56,
          minWidth: 56,
          paddingHorizontal: 24,
          paddingVertical: 14,
          borderRadius: 28,
        };
      case 'icon':
        return {
          minHeight: 44,
          minWidth: 44,
          padding: 8,
          borderRadius: 22,
        };
      case 'md':
      default:
        return {
          minHeight: 44,
          minWidth: 44,
          paddingHorizontal: 16,
          paddingVertical: 10,
          borderRadius: 20,
        };
    }
  };

  const getTextColor = (): string => {
    if (disabled) return theme.textSecondary;
    switch (variant) {
      case 'default':
        return '#000000'; // Dark text on gold accent for crisp contrast
      case 'secondary':
      case 'outline':
      case 'ghost':
      case 'icon':
      default:
        return theme.text;
    }
  };

  return (
    <Pressable
      disabled={disabled}
      accessibilityRole={accessibilityRole}
      accessibilityState={{ disabled: Boolean(disabled) }}
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [
        styles.base,
        getSizeContainerStyle(),
        getVariantContainerStyle(pressed),
        disabled && styles.disabled,
        style,
      ]}
      {...props}
    >
      {typeof children === 'string' || typeof children === 'number' ? (
        <Text
          variant={size === 'sm' ? 'caption' : 'body'}
          weight="semiBold"
          color={getTextColor()}
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
    gap: 8,
  },
  disabled: {
    opacity: 0.5,
  },
});

export default Button;
