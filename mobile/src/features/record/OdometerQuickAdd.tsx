import { Pressable, ScrollView, StyleSheet } from 'react-native';

import { T } from '@/components/ui/Typography';
import { Colors, Radius, Spacing } from '@/theme/tokens';

const STEPS = [50, 100, 500];

type Props = {
  value: number;
  original: number;
  onChange: (next: number) => void;
  /** Floor the value can't go below (e.g. the last recorded odometer reading). */
  min?: number;
};

/** +50/+100/+500 quick-add chips plus an Undo-to-original chip, reused across fuel/expense/service/odometer-roll. */
export function OdometerQuickAdd({ value, original, onChange, min }: Props) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {STEPS.map((s) => (
        <Pressable key={s} style={styles.chip} onPress={() => onChange(value + s)}>
          <T variant="bodyStrong" color={Colors.accent}>
            +{s}
          </T>
        </Pressable>
      ))}
      <Pressable style={styles.chip} onPress={() => onChange(Math.max(original, min ?? original))}>
        <T variant="bodyStrong" color={Colors.textMuted}>
          UNDO
        </T>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    gap: Spacing.xs,
    paddingVertical: Spacing.xs,
  },
  chip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.pill,
    backgroundColor: Colors.surfaceMuted,
  },
});
