import { StyleSheet, Text, type TextProps } from 'react-native';

import { Colors, FontFamily, Tracking } from '@/theme/tokens';

type Variant =
  | 'display'
  | 'heading'
  | 'subheading'
  | 'body'
  | 'bodyStrong'
  | 'meta'
  | 'eyebrow'
  | 'eyebrowStrong'
  | 'numeric'
  | 'numericLarge';

type Props = TextProps & {
  variant?: Variant;
  color?: string;
  center?: boolean;
};

export function T({ variant = 'body', color, center, style, ...rest }: Props) {
  return (
    <Text
      style={[
        styles.base,
        styles[variant],
        color ? { color } : null,
        center ? { textAlign: 'center' } : null,
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  base: {
    fontFamily: FontFamily.regular,
    color: Colors.text,
  },
  display: {
    fontFamily: FontFamily.bold,
    fontSize: 34,
    lineHeight: 40,
    letterSpacing: -0.5,
  },
  heading: {
    fontFamily: FontFamily.semiBold,
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: -0.2,
  },
  subheading: {
    fontFamily: FontFamily.semiBold,
    fontSize: 17,
    lineHeight: 23,
  },
  body: {
    fontFamily: FontFamily.regular,
    fontSize: 15,
    lineHeight: 21,
    color: Colors.text,
  },
  bodyStrong: {
    fontFamily: FontFamily.semiBold,
    fontSize: 15,
    lineHeight: 21,
    color: Colors.text,
  },
  meta: {
    fontFamily: FontFamily.medium,
    fontSize: 13,
    lineHeight: 18,
    color: Colors.textMuted,
  },
  eyebrow: {
    fontFamily: FontFamily.semiBold,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: Tracking.eyebrow,
    textTransform: 'uppercase',
    color: Colors.textMuted,
  },
  eyebrowStrong: {
    fontFamily: FontFamily.bold,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: Tracking.eyebrow,
    textTransform: 'uppercase',
    color: Colors.accent,
  },
  numeric: {
    fontFamily: FontFamily.semiBold,
    fontSize: 20,
    lineHeight: 26,
    color: Colors.text,
  },
  numericLarge: {
    fontFamily: FontFamily.bold,
    fontSize: 36,
    lineHeight: 40,
    letterSpacing: -0.5,
    color: Colors.text,
  },
});
