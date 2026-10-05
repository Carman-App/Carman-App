import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import { T } from '@/components/ui/Typography';
import { Colors, Spacing } from '@/theme/tokens';

type SectionHeaderProps = {
  title: string;
  action?: string;
  onAction?: () => void;
  right?: ReactNode;
  /**
   * - caps (default): bold tracked ink label, "HOW IT GETS USED".
   * - tag: blue tracked label, "REGION AND UNITS".
   * - section: blue sentence-case label, "Members".
   */
  tone?: 'caps' | 'tag' | 'section';
  /** Draw the hairline above the header, as the design does between sections. */
  rule?: boolean;
  /** Add the screen gutter, for sections inside full-bleed lists. */
  inset?: boolean;
  style?: ViewStyle;
};

export function SectionHeader({ title, action, onAction, right, tone = 'caps', rule, inset, style }: SectionHeaderProps) {
  return (
    <View style={[styles.row, rule && styles.rule, inset && styles.inset, style]}>
      <T variant={tone === 'caps' ? 'eyebrowStrong' : tone}>{title}</T>
      {action ? (
        <Pressable accessibilityRole="button" onPress={onAction} hitSlop={8}>
          <T variant="eyebrow" color={Colors.accent}>
            {action}
          </T>
        </Pressable>
      ) : (
        right ?? null
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  inset: {
    paddingHorizontal: Spacing.lg,
    marginTop: 0,
  },
  rule: {
    borderTopWidth: 1,
    borderTopColor: Colors.line,
    marginTop: Spacing.xs,
    paddingTop: 18,
  },
});
