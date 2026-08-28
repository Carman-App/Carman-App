import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { ProgressSteps } from '@/components/ui/ProgressSteps';
import { Screen } from '@/components/ui/Screen';
import { T } from '@/components/ui/Typography';
import { useOnboardingDraft } from '@/features/onboarding/context';
import type { AccountProfile } from '@/types/domain';
import { Colors, Radius, Spacing } from '@/theme/tokens';

const OPTIONS: { key: AccountProfile; title: string; sub: string }[] = [
  { key: 'owner', title: 'I own vehicles', sub: 'TRACK COSTS, SERVICE AND DOCUMENTS FOR WHAT YOU DRIVE' },
  { key: 'mechanic', title: 'I fix vehicles', sub: 'RUN JOBS, ESTIMATES AND INVOICES FOR CUSTOMERS' },
  { key: 'both', title: 'Both', sub: 'A PERSONAL GARAGE AND A WORKSHOP, SWITCHED FROM ONE ACCOUNT' },
];

export default function ProfileScreen() {
  const { draft, update } = useOnboardingDraft();

  return (
    <Screen
      footer={
        <Button onPress={() => router.push('/onboarding/garage')}>
          Continue · {draft.profile === 'owner' ? 'My Garage' : draft.profile === 'mechanic' ? 'My Workshop' : 'Both'}
        </Button>
      }>
      <ProgressSteps step={2} total={7} />
      <T variant="display">What brings you to Carma?</T>
      <T variant="body" color={Colors.textMuted} style={styles.sub}>
        This decides what Carma sets up first. You can change it later.
      </T>
      <View style={styles.options}>
        {OPTIONS.map((o) => {
          const selected = draft.profile === o.key;
          return (
            <Pressable key={o.key} onPress={() => update({ profile: o.key })} style={[styles.option, selected && styles.optionSelected]}>
              <T variant="subheading">{o.title}</T>
              <T variant="eyebrow" style={styles.optionSub}>
                {o.sub}
              </T>
            </Pressable>
          );
        })}
      </View>
      <T variant="meta" style={styles.footnote}>
        YOU CAN ADD A WORKSHOP PROFILE LATER IF YOU START FIXING CARS.
      </T>
    </Screen>
  );
}

const styles = StyleSheet.create({
  sub: {
    marginTop: Spacing.xs,
    marginBottom: Spacing.lg,
  },
  options: {
    gap: Spacing.sm,
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
    color: Colors.textMuted,
  },
  footnote: {
    marginTop: Spacing.md,
  },
});
