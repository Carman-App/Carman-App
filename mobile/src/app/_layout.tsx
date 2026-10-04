// One import per weight: the package's main entry requires all eight files
// (italics included, ~2 MB each), which Expo Go then downloads on every load.
import { GoogleSans_400Regular } from '@expo-google-fonts/google-sans/400Regular';
import { GoogleSans_500Medium } from '@expo-google-fonts/google-sans/500Medium';
import { GoogleSans_600SemiBold } from '@expo-google-fonts/google-sans/600SemiBold';
import { GoogleSans_700Bold } from '@expo-google-fonts/google-sans/700Bold';
import { useFonts } from 'expo-font';
import { QueryClientProvider } from '@tanstack/react-query';
import { router, Stack, usePathname } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { StatusBar, StyleSheet, View } from 'react-native';

import { setSignedOutHandler } from '@/data/api/client';
import { loadSession, useSessionLoaded } from '@/data/auth/session';
import { useHydrateOnMount, useUiState } from '@/data/hooks';
import { queryClient } from '@/data/queryClient';
import { installNotificationHandlers, registerForPush } from '@/features/notifications/push';
import { launchTarget } from '@/features/onboarding/progress';
import { withMonitoring } from '@/lib/monitoring';
import { Colors, Layout } from '@/theme/tokens';

SplashScreen.preventAutoHideAsync().catch(() => {});

/**
 * Root layout: loads fonts + kicks off AsyncStorage hydration, then mounts the
 * Stack. Onboarding-vs-app routing is decided once, by `app/index.tsx`
 * (the initial route) — NOT here, so that global data-store updates
 * elsewhere in the app (which this layout would otherwise re-render on)
 * never yank the user back to a redirect.
 */
// True once this JS runtime has started. A real launch (or a full reload)
// starts a new runtime; Fast Refresh does not, so saving a file keeps your place.
let launched = false;
const startedAt = Date.now();
const ORPHAN_WINDOW_MS = 20_000;
/** Screens a launch may legitimately open on. */
const STARTING_SCREENS = ['/onboarding', '/home', '/mechanic/dashboard'];

function RootLayout() {
  const [fontsLoaded] = useFonts({
    GoogleSans_400Regular,
    GoogleSans_500Medium,
    GoogleSans_600SemiBold,
    GoogleSans_700Bold,
  });
  const hydrated = useHydrateOnMount();
  const sessionLoaded = useSessionLoaded();
  const ready = fontsLoaded && hydrated && sessionLoaded;

  useEffect(() => {
    void loadSession();
    // A session that can no longer be refreshed (expired, revoked, account suspended) returns to Welcome.
    setSignedOutHandler(() => router.replace('/onboarding/welcome'));
  }, []);

  // Every launch opens on Welcome, or on the unfinished set-up step with its
  // answers. Expo Go (and Android) reopen the app on the last screen's URL,
  // e.g. /record/add, which would otherwise skip both. "/" is handled by index.
  // Until that redirect has happened the splash stays up and a blank cover
  // hides the reopened screen, so it never flashes before Welcome.
  const pathname = usePathname();
  const [routed, setRouted] = useState(launched);
  useEffect(() => {
    if (!ready || launched) return;
    launched = true;
    void launchTarget().then((target) => {
      // "/" is redirected by app/index.tsx itself.
      if (pathname !== '/' && target !== pathname) router.replace(target);
      // One frame for the new screen to render before uncovering.
      setTimeout(() => setRouted(true), 50);
    });
  }, [ready, pathname]);

  useEffect(() => {
    if (ready && routed) SplashScreen.hideAsync().catch(() => {});
  }, [ready, routed]);

  // Safety net for the same problem: Expo Go can hand the app the last
  // screen's address after the redirect above has run, opening e.g. "Add a
  // record" with nothing behind it. Shortly after launch, a screen that is
  // alone in the history and is not a starting screen goes back to the launch
  // target. Screens opened from inside the app always have history.
  useEffect(() => {
    if (!ready || Date.now() - startedAt > ORPHAN_WINDOW_MS) return;
    const startingScreen = pathname === '/' || STARTING_SCREENS.some((p) => pathname.startsWith(p));
    if (startingScreen || router.canGoBack()) return;
    void launchTarget().then((target) => {
      if (target !== pathname) router.replace(target);
    });
  }, [ready, pathname]);

  if (!ready) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />
      <PushSetup />
      {/* Tablets: a centred phone-width column, white either side. */}
      <View style={styles.page}>
        <View style={styles.column}>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: Colors.background } }}>
        {/* Add-record flow: entered as a modal sheet; sub-steps push within it. */}
        <Stack.Screen name="record/add" options={{ presentation: 'modal' }} />
        <Stack.Screen name="record/pick-vehicle" options={{ presentation: 'modal' }} />
        <Stack.Screen name="record/expense" options={{ presentation: 'modal' }} />
        <Stack.Screen name="record/odometer-roll" options={{ presentation: 'modal' }} />
        <Stack.Screen name="record/saved" options={{ presentation: 'modal' }} />
        <Stack.Screen name="doc/scan" options={{ presentation: 'modal' }} />
        <Stack.Screen name="build/stage/[stageId]/add-modification" options={{ presentation: 'modal' }} />
        <Stack.Screen name="build/stage/[stageId]/add-part" options={{ presentation: 'modal' }} />
        <Stack.Screen name="garages/add" options={{ presentation: 'modal' }} />
        <Stack.Screen name="garages/[id]/invite" options={{ presentation: 'modal' }} />
        <Stack.Screen name="vehicle/add" options={{ presentation: 'modal' }} />
      </Stack>
        </View>
      </View>
      {!routed ? <View style={[StyleSheet.absoluteFill, { backgroundColor: Colors.background }]} /> : null}
    </QueryClientProvider>
  );
}

/** Push notifications: shown and routed from startup; this phone registered once set-up is done. */
function PushSetup() {
  const onboarded = useUiState('onboarded');
  useEffect(() => installNotificationHandlers(), []);
  useEffect(() => {
    if (onboarded) void registerForPush();
  }, [onboarded]);
  return null;
}

export default withMonitoring(RootLayout);

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  column: {
    flex: 1,
    width: '100%',
    maxWidth: Layout.maxWidth,
    alignSelf: 'center',
  },
});
