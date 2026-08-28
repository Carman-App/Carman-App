import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import { T } from '@/components/ui/Typography';
import { Colors, Radius, Spacing } from '@/theme/tokens';

type ChipProps = {
  label: string;
  value?: string;
  fg?: string;
  bg?: string;
  onPress?: () => void;
  selected?: boolean;
  style?: ViewStyle;
};

/** Small pill used for category breakdowns, filters and status badges. */
export function Chip({ label, value, fg = Colors.textMuted, bg = Colors.surfaceMuted, onPress, selected, style }: ChipProps) {
  const Wrapper = onPress ? Pressable : View;
  return (
    <Wrapper
      onPress={onPress}
      style={[
        styles.base,
        { backgroundColor: selected ? Colors.accent : bg },
        style,
      ]}>
      <T variant="meta" color={selected ? Colors.white : fg} style={{ fontFamily: undefined }}>
        {value ? `${label} ${value}` : label}
      </T>
    </Wrapper>
  );
}

type StatPillProps = {
  label: string;
  children?: ReactNode;
};

export function StatPill({ label, children }: StatPillProps) {
  return (
    <View style={styles.statPill}>
      <T variant="eyebrow">{label}</T>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingVertical: 6,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.pill,
    flexDirection: 'row',
    alignItems: 'center',
  },
  statPill: {
    gap: 4,
  },
});
