import { router } from 'expo-router';

import { Button } from '@/components/ui/Button';
import { ChoiceRow } from '@/components/ui/ChoiceRow';
import { useOnboardingDraft } from '@/features/onboarding/context';
import { OnboardingScreen } from '@/features/onboarding/OnboardingScreen';
import { Colors } from '@/theme/tokens';
import type { AccountProfile } from '@/types/domain';

const OPTIONS: { key: AccountProfile; title: string; sub: string; glyph: string; hue: string; tint: string }[] = [
  { key: 'owner', title: 'Personal: I own vehicles', sub: 'Track costs, service and documents for what you drive', glyph: 'vehicle', hue: Colors.accent, tint: Colors.accentSoft },
  { key: 'mechanic', title: 'Mechanic: I fix vehicles', sub: 'Run jobs, estimates and invoices for customers', glyph: 'service', hue: Colors.orange, tint: Colors.warningSoft },
  { key: 'both', title: 'Both', sub: 'A personal garage and a workshop, switched from one account', glyph: 'switch-profile', hue: Colors.positive, tint: Colors.positiveSoft },
];

/** What brings you: owner, mechanic or both. This decides which set up runs next. */
export default function RoleScreen() {
  const { draft, update } = useOnboardingDraft();
  return (
    <OnboardingScreen
      backLabel="COUNTRY"
      step={{ step: 2, total: 6 }}
      title="What brings you to Carma?"
      lede="This decides what Carma sets up first. You can change it later."
      bleed
      footer={
        <Button onPress={() => router.push(draft.profile === 'mechanic' ? '/onboarding/workshop' : '/onboarding/garage')}>Continue</Button>
      }>
      {OPTIONS.map((o) => (
        <ChoiceRow key={o.key} title={o.title} sub={o.sub} glyph={o.glyph} hue={o.hue} tint={o.tint} selected={draft.profile === o.key} onPress={() => update({ profile: o.key })} />
      ))}
    </OnboardingScreen>
  );
}
