import { router } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';

import { useOnboarded } from '@/data/hooks';
import { getUiState } from '@/data/uiState';
import { Colors } from '@/theme/tokens';

/**
 * Cold-start gate. Runs its redirect exactly once (on mount, before the app
 * has navigated anywhere), then unmounts — so it never fires again on later
 * global data-store updates the way a redirect living in the root layout
 * would. Onboarded devices land on Home, or on the workshop home when the
 * device was last used as a mechanic.
 */
export default function Index() {
  const onboarded = useOnboarded();

  useEffect(() => {
    if (!onboarded) router.replace('/onboarding/welcome');
    else if (getUiState().mode === 'mechanic') router.replace('/mechanic/dashboard');
    else router.replace('/home');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <View style={{ flex: 1, backgroundColor: Colors.background }} />;
}
