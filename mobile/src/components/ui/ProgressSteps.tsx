import { StyleSheet, View } from 'react-native';

import { T } from '@/components/ui/Typography';
import { Colors, Radius, Spacing } from '@/theme/tokens';

type ProgressStepsProps = {
  step: number;
  total: number;
};

/** "STEP N / TOTAL" eyebrow + track, used throughout onboarding and multi-step wizards. */
export function ProgressSteps({ step, total }: ProgressStepsProps) {
  return (
    <View style={styles.wrap}>
      <T variant="eyebrow">
        STEP {String(step).padStart(2, '0')} / {String(total).padStart(2, '0')}
      </T>
      <View style={styles.track}>
        {Array.from({ length: total }).map((_, i) => (
          <View key={i} style={[styles.segment, i < step ? styles.segmentActive : null]} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: Spacing.xs,
    marginBottom: Spacing.md,
  },
  track: {
    flexDirection: 'row',
    gap: 4,
  },
  segment: {
    flex: 1,
    height: 3,
    borderRadius: Radius.pill,
    backgroundColor: Colors.border,
  },
  segmentActive: {
    backgroundColor: Colors.accent,
  },
});
