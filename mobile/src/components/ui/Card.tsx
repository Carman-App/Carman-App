import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import { Colors, Radius, Spacing } from '@/theme/tokens';

type CardProps = {
  children: ReactNode;
  style?: ViewStyle;
  onPress?: () => void;
  padded?: boolean;
  /** Kept for API compatibility: every card now carries the design's tinted hairline. */
  bordered?: boolean;
  /** Pale-blue filled card (e.g. the approval line, the cost summary). */
  tone?: 'plain' | 'blue' | 'sand' | 'warning';
};

/** Flat surface with a 1px tinted outline. The design uses no drop shadows on cards. */
export function Card({ children, style, onPress, padded = true, tone = 'plain' }: CardProps) {
  const content = (
    <View style={[styles.base, padded && styles.padded, toneStyle[tone], style]}>
      {children}
    </View>
  );
  if (!onPress) return content;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [pressed && styles.pressed]}>
      {content}
    </Pressable>
  );
}

const toneStyle = StyleSheet.create({
  plain: {},
  blue: { backgroundColor: Colors.accentSoft, borderColor: Colors.lineStrong },
  sand: { backgroundColor: Colors.surfaceWarm, borderColor: 'transparent' },
  warning: { backgroundColor: Colors.signalSoft, borderColor: 'transparent' },
});

const styles = StyleSheet.create({
  base: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.line,
  },
  padded: {
    padding: Spacing.md,
  },
  pressed: {
    opacity: 0.85,
  },
});
