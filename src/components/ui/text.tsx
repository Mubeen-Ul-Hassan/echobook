import React from 'react';
import { Text as RNText, TextProps as RNTextProps, StyleSheet, TextStyle, StyleProp } from 'react-native';
import { useTheme } from '@/hooks/use-theme';
import { Fonts } from '@/constants/theme';
import { cn } from '@/lib/utils';

export type TextVariant = 'h1' | 'h2' | 'h3' | 'subhead' | 'body' | 'caption';

export interface TextProps extends RNTextProps {
  variant?: TextVariant;
  color?: string;
  align?: 'auto' | 'left' | 'right' | 'center' | 'justify';
  weight?: 'normal' | 'medium' | 'semiBold' | 'bold' | 'extraBold';
  className?: string;
}

export function Text({
  variant = 'body',
  color,
  align,
  weight,
  style,
  className,
  children,
  ...props
}: TextProps) {
  const theme = useTheme();

  const getVariantStyle = (): TextStyle => {
    switch (variant) {
      case 'h1':
        return {
          fontSize: 24,
          lineHeight: 30,
          fontFamily: Fonts.bold,
          color: color || theme.text,
        };
      case 'h2':
        return {
          fontSize: 20,
          lineHeight: 26,
          fontFamily: Fonts.bold,
          color: color || theme.text,
        };
      case 'h3':
        return {
          fontSize: 16,
          lineHeight: 22,
          fontFamily: Fonts.semiBold,
          color: color || theme.text,
        };
      case 'subhead':
        return {
          fontSize: 14,
          lineHeight: 18,
          fontFamily: Fonts.medium,
          color: color || theme.textSecondary,
        };
      case 'caption':
        return {
          fontSize: 12,
          lineHeight: 16,
          fontFamily: Fonts.sans,
          color: color || theme.textSecondary,
        };
      case 'body':
      default:
        return {
          fontSize: 14,
          lineHeight: 20,
          fontFamily: Fonts.sans,
          color: color || theme.text,
        };
    }
  };

  const getWeightStyle = (): TextStyle | null => {
    if (!weight) return null;
    switch (weight) {
      case 'normal':
        return { fontFamily: Fonts.sans };
      case 'medium':
        return { fontFamily: Fonts.medium };
      case 'semiBold':
        return { fontFamily: Fonts.semiBold };
      case 'bold':
        return { fontFamily: Fonts.bold };
      case 'extraBold':
        return { fontFamily: Fonts.extraBold };
      default:
        return null;
    }
  };

  const combinedStyles: StyleProp<TextStyle> = [
    styles.base,
    getVariantStyle(),
    align ? { textAlign: align } : undefined,
    getWeightStyle() || undefined,
    style,
  ];

  return (
    <RNText
      accessibilityRole="text"
      style={combinedStyles}
      {...props}
    >
      {children}
    </RNText>
  );
}

const styles = StyleSheet.create({
  base: {
    includeFontPadding: false,
  },
});

export default Text;
