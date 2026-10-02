import { router } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';

import { launchTarget } from '@/features/onboarding/progress';
import { Colors } from '@/theme/tokens';

/**
 * Cold start: Welcome, or the unfinished set-up step with its answers
 * (see features/onboarding/progress.ts). Runs once on mount.
 */
export default function Index() {
  useEffect(() => {
    void launchTarget().then((target) => router.replace(target));
  }, []);

  return <View style={{ flex: 1, backgroundColor: Colors.background }} />;
}
