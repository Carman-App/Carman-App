import {
  Figtree_400Regular,
  Figtree_500Medium,
  Figtree_600SemiBold,
  Figtree_700Bold,
  useFonts,
} from '@expo-google-fonts/figtree';
import { QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { StatusBar } from 'react-native';

import { useHydrateOnMount, useSyncAccountCurrency } from '@/data/hooks';
import { queryClient } from '@/data/queryClient';
import { Colors } from '@/theme/tokens';

/** Mounted inside `QueryClientProvider` so `useAccount` (a query hook) can run — keeps `formatMoney` region-aware app-wide. See `useSyncAccountCurrency`'s doc. */
function CurrencySync() {
  useSyncAccountCurrency();
  return null;
}

SplashScreen.preventAutoHideAsync().catch(() => {});

/**
 * Root layout: loads fonts + kicks off AsyncStorage hydration, then mounts the
 * Stack. Onboarding-vs-app routing is decided once, by `app/index.tsx`
 * (the initial route) — NOT here, so that global data-store updates
 * elsewhere in the app (which this layout would otherwise re-render on)
 * never yank the user back to a redirect.
 */
export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Figtree_400Regular,
    Figtree_500Medium,
    Figtree_600SemiBold,
    Figtree_700Bold,
  });
  const hydrated = useHydrateOnMount();
  const ready = fontsLoaded && hydrated;

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  if (!ready) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <CurrencySync />
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: Colors.background } }}>
        {/* Add-record flow: entered as a modal sheet; sub-steps push within it. */}
        <Stack.Screen name="record/add" options={{ presentation: 'modal' }} />
        <Stack.Screen name="record/pick-vehicle" options={{ presentation: 'modal' }} />
        <Stack.Screen name="record/fuel" options={{ presentation: 'modal' }} />
        <Stack.Screen name="record/expense" options={{ presentation: 'modal' }} />
        <Stack.Screen name="record/service" options={{ presentation: 'modal' }} />
        <Stack.Screen name="record/odometer-roll" options={{ presentation: 'modal' }} />
        <Stack.Screen name="record/pick-place" options={{ presentation: 'modal' }} />
        <Stack.Screen name="record/pick-date" options={{ presentation: 'modal' }} />
        <Stack.Screen name="record/saved" options={{ presentation: 'modal' }} />
        <Stack.Screen name="doc/scan" options={{ presentation: 'modal' }} />
        <Stack.Screen name="build/stage/[stageId]/add-modification" options={{ presentation: 'modal' }} />
        <Stack.Screen name="build/stage/[stageId]/add-part" options={{ presentation: 'modal' }} />
        <Stack.Screen name="garages/add" options={{ presentation: 'modal' }} />
        <Stack.Screen name="garages/[id]/invite" options={{ presentation: 'modal' }} />
        <Stack.Screen name="vehicle/add" options={{ presentation: 'modal' }} />
      </Stack>
    </QueryClientProvider>
  );
}
