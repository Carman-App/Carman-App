import { router } from 'expo-router';

import { Button } from '@/components/ui/Button';
import { ChoiceRow } from '@/components/ui/ChoiceRow';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { useOnboardingDraft } from '@/features/onboarding/context';
import { OnboardingScreen } from '@/features/onboarding/OnboardingScreen';
import { Colors } from '@/theme/tokens';
import type { VehicleType, VehicleUsage } from '@/types/domain';

const TYPES: { key: VehicleType; title: string; sub: string; glyph: string }[] = [
  { key: 'car', title: 'Car', sub: 'Saloon, SUV, pickup or van', glyph: 'vehicle' },
  { key: 'motorcycle', title: 'Motorcycle', sub: 'Road, adventure or scooter', glyph: 'motorcycle' },
];

const USAGES: { key: VehicleUsage; title: string; sub: string; glyph: string }[] = [
  { key: 'daily', title: 'Daily driver', sub: 'Driven regularly, service reminders on', glyph: 'timeline' },
  { key: 'weekend', title: 'Weekend', sub: 'Driven now and then, reminders by date', glyph: 'date' },
  { key: 'project', title: 'Project vehicle', sub: 'Off the road for now, reminders paused', glyph: 'build' },
];

/** Vehicle type and usage decide which fields and which reminders the vehicle gets. */
export default function VehicleTypeScreen() {
  const { draft, update } = useOnboardingDraft();
  return (
    <OnboardingScreen
      backLabel="GARAGE"
      step={{ step: 4, total: 6 }}
      title="What are you adding?"
      bleed
      footer={<Button onPress={() => router.push('/onboarding/make-model')}>Continue</Button>}>
      {TYPES.map((t) => (
        <ChoiceRow key={t.key} title={t.title} sub={t.sub} glyph={t.glyph} selected={draft.vehicleType === t.key} onPress={() => update({ vehicleType: t.key, make: '', model: '' })} />
      ))}
      <SectionHeader title="HOW IT GETS USED" rule inset />
      {USAGES.map((u) => (
        <ChoiceRow key={u.key} title={u.title} sub={u.sub} glyph={u.glyph} hue={Colors.positive} tint={Colors.positiveSoft} selected={draft.usage === u.key} onPress={() => update({ usage: u.key })} />
      ))}
    </OnboardingScreen>
  );
}
