import React from 'react';
import { View, ViewProps, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { useTheme } from '@/hooks/use-theme';
import { Text, TextProps } from '@/components/ui/text';

export interface CardProps extends ViewProps {
  style?: StyleProp<ViewStyle>;
  className?: string;
  children?: React.ReactNode;
}

export function Card({ style, children, ...props }: CardProps) {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.cardBase,
        {
          backgroundColor: theme.card,
          borderColor: theme.border,
        },
        style,
      ]}
      {...props}
    >
      {children}
    </View>
  );
}

export function CardHeader({ style, children, ...props }: CardProps) {
  return (
    <View style={[styles.headerBase, style]} {...props}>
      {children}
    </View>
  );
}

export function CardTitle({ children, style, ...props }: TextProps) {
  return (
    <Text variant="h3" weight="bold" style={style} {...props}>
      {children}
    </Text>
  );
}

export function CardDescription({ children, style, ...props }: TextProps) {
  return (
    <Text variant="subhead" style={style} {...props}>
      {children}
    </Text>
  );
}

export function CardContent({ style, children, ...props }: CardProps) {
  return (
    <View style={[styles.contentBase, style]} {...props}>
      {children}
    </View>
  );
}

export function CardFooter({ style, children, ...props }: CardProps) {
  return (
    <View style={[styles.footerBase, style]} {...props}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  cardBase: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  headerBase: {
    marginBottom: 12,
  },
  contentBase: {
    padding: 0,
  },
  footerBase: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
});

export default Card;
