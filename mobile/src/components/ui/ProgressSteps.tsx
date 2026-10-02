import { StyleSheet, View } from 'react-native';

import { T } from '@/components/ui/Typography';
import { Colors, Radius, Spacing } from '@/theme/tokens';

type ProgressStepsProps = {
  step: number;
  total: number;
  label?: string;
  /** Show the segmented track under the counter. The design shows only the counter. */
  track?: boolean;
};

/** "STEP 02 / 06" counter with the current step in Carma blue. */
export function StepCounter({ step, total, label = 'STEP' }: Omit<ProgressStepsProps, 'track'>) {
  return (
    <T variant="eyebrow" color={Colors.body}>
      {label} <T variant="eyebrow" color={Colors.accent}>{String(step).padStart(2, '0')}</T> / {String(total).padStart(2, '0')}
    </T>
  );
}

export function ProgressSteps({ step, total, label, track = false }: ProgressStepsProps) {
  return (
    <View style={styles.wrap}>
      <StepCounter step={step} total={total} label={label} />
      {track ? (
        <View style={styles.track}>
          {Array.from({ length: total }).map((_, i) => (
            <View key={i} style={[styles.segment, i < step ? styles.segmentActive : null]} />
          ))}
        </View>
      ) : null}
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
    backgroundColor: Colors.line,
  },
  segmentActive: {
    backgroundColor: Colors.accent,
  },
});
