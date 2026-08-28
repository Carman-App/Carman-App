import { Stack } from 'expo-router';

import { OnboardingProvider } from '@/features/onboarding/context';
import { Colors } from '@/theme/tokens';

export default function OnboardingLayout() {
  return (
    <OnboardingProvider>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: Colors.background }, animation: 'slide_from_right' }} />
    </OnboardingProvider>
  );
}
