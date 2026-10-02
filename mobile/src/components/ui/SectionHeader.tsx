import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

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
};

export function SectionHeader({ title, action, onAction, right, tone = 'caps', rule }: SectionHeaderProps) {
  return (
    <View style={[styles.row, rule && styles.rule]}>
      <T variant={tone === 'caps' ? 'eyebrowStrong' : tone}>{title}</T>
      {action ? (
        <Pressable onPress={onAction} hitSlop={8}>
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
  rule: {
    borderTopWidth: 1,
    borderTopColor: Colors.line,
    marginTop: Spacing.xs,
    paddingTop: 18,
  },
});
