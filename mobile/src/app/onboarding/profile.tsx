import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { ChoiceRow } from '@/components/ui/ChoiceRow';
import { T } from '@/components/ui/Typography';
import { useOnboardingDraft } from '@/features/onboarding/context';
import { OnboardingScreen } from '@/features/onboarding/OnboardingScreen';
import { Colors, Spacing } from '@/theme/tokens';
import type { AccountProfile } from '@/types/domain';

// Design (screen "What brings you"): car-01, wrench-01, and both icons for "Both".
const OPTIONS: { key: AccountProfile; title: string; sub: string; glyph: string; glyph2?: string }[] = [
  { key: 'owner', title: 'Personal: I own vehicles', sub: 'Track costs, service and documents for what you drive', glyph: 'vehicle' },
  { key: 'mechanic', title: 'Mechanic: I fix vehicles', sub: 'Run jobs, estimates and invoices for customers', glyph: 'service' },
  { key: 'both', title: 'Both', sub: 'A personal garage and a workshop, switched from one account', glyph: 'vehicle', glyph2: 'service' },
];

const CTA: Record<AccountProfile, string> = { owner: 'Add my vehicle', mechanic: 'Set up my workshop', both: 'Start with my vehicle' };
const NOTE: Record<AccountProfile, string> = {
  owner: 'You can add a workshop later from settings.',
  mechanic: 'No vehicle needed. You can add one later from settings.',
  both: 'Carma sets up your vehicle first, then your workshop.',
};

/** What brings you: owner, mechanic or both. This decides which set up runs next. */
export default function RoleScreen() {
  const { draft, update } = useOnboardingDraft();
  const role = draft.profile;
  return (
    <OnboardingScreen
      backLabel="COUNTRY"
      step={{ step: 2, total: 6 }}
      title="What brings you to Carma?"
      lede="This decides what Carma sets up first. You can change it later."
      bleed
      footer={
        <View style={styles.foot}>
          {role ? (
            <T variant="small" color={Colors.textFaint}>
              {NOTE[role]}
            </T>
          ) : null}
          <Button disabled={!role} onPress={() => router.push(role === 'mechanic' ? '/onboarding/workshop' : '/onboarding/garage')}>
            {role ? CTA[role] : 'Continue'}
          </Button>
        </View>
      }>
      {OPTIONS.map((o) => (
        <ChoiceRow key={o.key} title={o.title} sub={o.sub} glyph={o.glyph} glyph2={o.glyph2} selected={role === o.key} onPress={() => update({ profile: o.key })} />
      ))}
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  foot: {
    gap: Spacing.md,
  },
});
