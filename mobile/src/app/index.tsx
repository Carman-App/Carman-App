import { router } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';

import { useOnboarded } from '@/data/hooks';
import { Colors } from '@/theme/tokens';

/**
 * Cold-start gate. Runs its redirect exactly once (on mount, before the app
 * has navigated anywhere), then unmounts — so it never fires again on later
 * global data-store updates the way a redirect living in the root layout
 * would.
 */
export default function Index() {
  const onboarded = useOnboarded();

  useEffect(() => {
    if (onboarded) {
      router.replace('/garage');
    } else {
      router.replace('/onboarding/welcome');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <View style={{ flex: 1, backgroundColor: Colors.background }} />;
}
