import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { ProgressSteps } from '@/components/ui/ProgressSteps';
import { Screen } from '@/components/ui/Screen';
import { T } from '@/components/ui/Typography';
import { useOnboardingDraft } from '@/features/onboarding/context';
import { type VehicleUsage } from '@/types/domain';
import { Colors, Radius, Spacing } from '@/theme/tokens';

const OPTIONS: { key: VehicleUsage; title: string; sub: string }[] = [
  {
    key: 'daily',
    title: 'Daily Driver',
    sub: 'Used regularly for everyday transport. Tracks running costs, service intervals and reminders.',
  },
  {
    key: 'project',
    title: 'Project Vehicle',
    sub: 'Being restored, modified or rebuilt over time. Adds build history, parts, modifications and total invested.',
  },
];

export default function UsageScreen() {
  const { draft, update } = useOnboardingDraft();
  const selectedTitle = OPTIONS.find((o) => o.key === draft.usage)?.title ?? OPTIONS[0].title;

  return (
    <Screen footer={<Button onPress={() => router.push('/onboarding/make-model')}>Continue · {selectedTitle}</Button>}>
      <ProgressSteps step={5} total={7} />
      <T variant="display">How do you use this vehicle?</T>
      <View style={styles.options}>
        {OPTIONS.map((o) => {
          const selected = draft.usage === o.key;
          return (
            <Pressable key={o.key} onPress={() => update({ usage: o.key })} style={[styles.option, selected && styles.optionSelected]}>
              <T variant="subheading">{o.title}</T>
              <T variant="body" color={Colors.textMuted} style={styles.optionSub}>
                {o.sub}
              </T>
            </Pressable>
          );
        })}
      </View>
      <T variant="meta" style={styles.footnote}>
        YOU CAN CHANGE THIS LATER
      </T>
    </Screen>
  );
}

const styles = StyleSheet.create({
  options: {
    gap: Spacing.sm,
    marginTop: Spacing.lg,
  },
  option: {
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    gap: 6,
  },
  optionSelected: {
    borderColor: Colors.accent,
    backgroundColor: Colors.accentSoft,
  },
  optionSub: {
    marginTop: 2,
  },
  footnote: {
    marginTop: Spacing.md,
  },
});
