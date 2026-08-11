import { Platform, StyleSheet, Text, type TextProps } from 'react-native';

import { Fonts, ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ThemedTextProps = TextProps & {
  type?:
    | 'default'
    | 'title'
    | 'small'
    | 'smallBold'
    | 'subtitle'
    | 'link'
    | 'linkPrimary'
    | 'code'
    | 'audibleHeader'
    | 'sectionTitle'
    | 'captionBold'
    | 'chapterTitle';
  themeColor?: ThemeColor;
};

export function ThemedText({ style, type = 'default', themeColor, ...rest }: ThemedTextProps) {
  const theme = useTheme();

  return (
    <Text
      style={[
        { color: theme[themeColor ?? 'text'] },
        type === 'default' && styles.default,
        type === 'title' && styles.title,
        type === 'small' && styles.small,
        type === 'smallBold' && styles.smallBold,
        type === 'subtitle' && styles.subtitle,
        type === 'link' && styles.link,
        type === 'linkPrimary' && styles.linkPrimary,
        type === 'code' && styles.code,
        type === 'audibleHeader' && styles.audibleHeader,
        type === 'sectionTitle' && styles.sectionTitle,
        type === 'captionBold' && styles.captionBold,
        type === 'chapterTitle' && styles.chapterTitle,
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  small: {
    fontFamily: Fonts.medium,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
  },
  smallBold: {
    fontFamily: Fonts.bold,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
  default: {
    fontFamily: Fonts.medium,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '500',
  },
  title: {
    fontFamily: Fonts.extraBold,
    fontSize: 28,
    fontWeight: '800',
    lineHeight: 34,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontFamily: Fonts.bold,
    fontSize: 20,
    lineHeight: 28,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  audibleHeader: {
    fontFamily: Fonts.extraBold,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  sectionTitle: {
    fontFamily: Fonts.bold,
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.1,
  },
  captionBold: {
    fontFamily: Fonts.bold,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  chapterTitle: {
    fontFamily: Fonts.semiBold,
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 22,
  },
  link: {
    fontFamily: Fonts.sans,
    lineHeight: 24,
    fontSize: 14,
  },
  linkPrimary: {
    fontFamily: Fonts.semiBold,
    lineHeight: 24,
    fontSize: 14,
    color: '#F7991C',
    fontWeight: '600',
  },
  code: {
    fontFamily: Fonts.mono,
    fontWeight: Platform.select({ android: '700' }) ?? '500',
    fontSize: 12,
  },
});
