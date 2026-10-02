import { router } from 'expo-router';

import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { useOnboardingDraft } from '@/features/onboarding/context';
import { OnboardingScreen } from '@/features/onboarding/OnboardingScreen';

/** First garage. The garage is the container people are invited into, so it is named before any vehicle exists. */
export default function FirstGarageScreen() {
  const { draft, update } = useOnboardingDraft();
  const ok = draft.garageName.trim().length > 0;
  return (
    <OnboardingScreen
      step={{ step: 3, total: 6 }}
      title="Name your first garage"
      lede="A garage holds vehicles and the people you share them with."
      footer={
        <Button disabled={!ok} onPress={() => router.push('/onboarding/vehicle-type')}>
          Add the first vehicle
        </Button>
      }>
      <TextField value={draft.garageName} onChangeText={(v) => update({ garageName: v })} placeholder="e.g. Mwangi Family" autoFocus autoCapitalize="words" />
    </OnboardingScreen>
  );
}
