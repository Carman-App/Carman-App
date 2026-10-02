import { StyleSheet, Text, type TextProps } from 'react-native';

import { Colors, FontFamily, Tracking } from '@/theme/tokens';

type Variant =
  | 'hero'
  | 'display'
  | 'heading'
  | 'subheading'
  | 'lede'
  | 'body'
  | 'bodyStrong'
  | 'meta'
  | 'small'
  | 'eyebrow'
  | 'eyebrowStrong'
  | 'tag'
  | 'section'
  | 'numeric'
  | 'numericLarge'
  | 'figure';

type Props = TextProps & {
  variant?: Variant;
  color?: string;
  center?: boolean;
};

/**
 * Carma type scale (Google Sans). The design's voice: heavy, tightly-set
 * headlines; slate-blue ledes; tracked uppercase labels at 10px.
 */
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
  /** Welcome headline: 44px heavy. */
  hero: {
    fontFamily: FontFamily.bold,
    fontSize: 44,
    lineHeight: 46,
    letterSpacing: -0.5,
    color: Colors.body,
  },
  /** Screen title: 32px heavy, e.g. "Where are you based?". */
  display: {
    fontFamily: FontFamily.bold,
    fontSize: 32,
    lineHeight: 34,
    letterSpacing: -0.4,
    color: Colors.body,
  },
  heading: {
    fontFamily: FontFamily.bold,
    fontSize: 22,
    lineHeight: 26,
    letterSpacing: -0.3,
    color: Colors.ink,
  },
  subheading: {
    fontFamily: FontFamily.medium,
    fontSize: 17,
    lineHeight: 22,
    letterSpacing: -0.2,
    color: Colors.ink,
  },
  /** Slate-blue sentence under a title. */
  lede: {
    fontFamily: FontFamily.regular,
    fontSize: 14,
    lineHeight: 21,
    color: Colors.slate,
  },
  body: {
    fontFamily: FontFamily.regular,
    fontSize: 14,
    lineHeight: 21,
    color: Colors.body,
  },
  bodyStrong: {
    fontFamily: FontFamily.medium,
    fontSize: 14,
    lineHeight: 18,
    color: Colors.ink,
  },
  meta: {
    fontFamily: FontFamily.regular,
    fontSize: 13,
    lineHeight: 19,
    color: Colors.textMuted,
  },
  small: {
    fontFamily: FontFamily.regular,
    fontSize: 12,
    lineHeight: 17,
    color: Colors.textMuted,
  },
  /** 10px tracked uppercase, e.g. "STEP 01 / 06", "TOYOTA · 2018". */
  eyebrow: {
    fontFamily: FontFamily.regular,
    fontSize: 10,
    lineHeight: 14,
    letterSpacing: Tracking.label,
    textTransform: 'uppercase',
    color: Colors.textMuted,
  },
  /** Bold tracked section label, e.g. "POWERTRAIN", "HOW IT GETS USED". */
  eyebrowStrong: {
    fontFamily: FontFamily.bold,
    fontSize: 10,
    lineHeight: 14,
    letterSpacing: Tracking.eyebrow,
    textTransform: 'uppercase',
    color: Colors.body,
  },
  /** Blue tracked label, e.g. "REGION AND UNITS", "MONTH BY MONTH". */
  tag: {
    fontFamily: FontFamily.bold,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: Tracking.eyebrow,
    textTransform: 'uppercase',
    color: Colors.accent,
  },
  /** Blue sentence-case section label, e.g. "Cost", "Members". */
  section: {
    fontFamily: FontFamily.semiBold,
    fontSize: 12,
    lineHeight: 16,
    color: Colors.accent,
  },
  numeric: {
    fontFamily: FontFamily.medium,
    fontSize: 20,
    lineHeight: 24,
    color: Colors.ink,
  },
  numericLarge: {
    fontFamily: FontFamily.bold,
    fontSize: 32,
    lineHeight: 36,
    letterSpacing: -0.5,
    color: Colors.ink,
  },
  /** The big money/odometer figure: 44px. */
  figure: {
    fontFamily: FontFamily.bold,
    fontSize: 44,
    lineHeight: 48,
    letterSpacing: -1,
    color: Colors.ink,
  },
});
