import { router } from 'expo-router';

import { Button } from '@/components/ui/Button';
import { ChoiceRow } from '@/components/ui/ChoiceRow';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { useOnboardingDraft } from '@/features/onboarding/context';
import { OnboardingScreen } from '@/features/onboarding/OnboardingScreen';
import type { VehicleType, VehicleUsage } from '@/types/domain';

// Design (screen "Vehicle type"): car-01 / motorbike-02, road-01 / wrench-01.
const TYPES: { key: VehicleType; title: string; sub: string; glyph: string }[] = [
  { key: 'car', title: 'Car', sub: 'Saloon, SUV, pickup or van', glyph: 'vehicle' },
  { key: 'motorcycle', title: 'Motorcycle', sub: 'Road, adventure or scooter', glyph: 'motorbike' },
];

const USAGES: { key: VehicleUsage; title: string; sub: string; glyph: string }[] = [
  { key: 'daily', title: 'Daily driver', sub: 'Driven regularly, service reminders on', glyph: 'road' },
  { key: 'project', title: 'Project vehicle', sub: 'Off the road for now, reminders paused', glyph: 'service' },
];

/** Vehicle type and usage decide which fields and which reminders the vehicle gets. */
export default function VehicleTypeScreen() {
  const { draft, update } = useOnboardingDraft();
  const ok = !!draft.vehicleType && !!draft.usage;
  const cta = draft.vehicleType ? `Continue with ${draft.vehicleType === 'motorcycle' ? 'motorcycle' : 'car'}` : 'Continue';
  return (
    <OnboardingScreen
      backLabel="GARAGE"
      step={{ step: 4, total: 6 }}
      title="What are you adding?"
      bleed
      footer={
        <Button disabled={!ok} onPress={() => router.push('/onboarding/make-model')}>
          {cta}
        </Button>
      }>
      {TYPES.map((t) => (
        <ChoiceRow
          key={t.key}
          title={t.title}
          sub={t.sub}
          glyph={t.glyph}
          selected={draft.vehicleType === t.key}
          // A different type has different makes: start make, model and year again.
          onPress={() => draft.vehicleType !== t.key && update({ vehicleType: t.key, make: '', model: '', year: undefined, transmission: undefined })}
        />
      ))}
      <SectionHeader title="HOW IT GETS USED" rule inset />
      {USAGES.map((u) => (
        <ChoiceRow key={u.key} title={u.title} sub={u.sub} glyph={u.glyph} selected={draft.usage === u.key} onPress={() => update({ usage: u.key })} />
      ))}
    </OnboardingScreen>
  );
}
