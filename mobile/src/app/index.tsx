import { router } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';

import { Colors } from '@/theme/tokens';

/**
 * Cold start. Every launch opens on Welcome. A device that has already been
 * set up gets a "Continue" there, which goes on to Home or the workshop.
 * Runs once on mount, so later store updates never redirect again.
 */
export default function Index() {
  useEffect(() => {
    router.replace('/onboarding/welcome');
  }, []);

  return <View style={{ flex: 1, backgroundColor: Colors.background }} />;
}
