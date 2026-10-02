import * as AppleAuthentication from 'expo-apple-authentication';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { OptionSheet } from '@/components/ui/OptionSheet';
import { T } from '@/components/ui/Typography';
import { serverAddress } from '@/data/api/client';
import { useSignedIn } from '@/data/auth/session';
import { useAccount, useOnboarded, useUiState } from '@/data/hooks';
import { getUiState } from '@/data/uiState';
import { appleAvailable, fetchAuthConfig, googleAvailable, signInWithApple, signInWithGoogle, signOut, type SignInOutcome } from '@/features/auth/signIn';
import { Colors, Spacing, Tracking } from '@/theme/tokens';

/**
 * Welcome, as designed: one "Get started" into the set-up flow (Where are
 * you based? · STEP 01). The three stripes are the Carma blue, signal red and
 * yellow.
 * - Not signed in: Get started opens a sheet to continue with Apple or
 *   Google first (in development the demo account skips it).
 * - Signed in and set up: Continue as <name>.
 */
export default function WelcomeScreen() {
  const signedIn = useSignedIn();
  const onboarded = useOnboarded();
  const mode = useUiState('mode');
  const [busy, setBusy] = useState<'apple' | 'google' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sheet, setSheet] = useState(false);
  const [providers, setProviders] = useState({ apple: false, google: false, dev: false, reachable: true, checked: false, trialDays: null as number | null });
  const [attempt, setAttempt] = useState(0);
  const devAllowed = __DEV__ && !!process.env.EXPO_PUBLIC_DEV_ACCOUNT_ID;
  // With no session, the account is only knowable through the development demo account.
  const account = useAccount().data;
  const firstName = signedIn || providers.dev ? account?.name?.split(' ')[0] : undefined;

  useEffect(() => {
    let live = true;
    void (async () => {
      const [config, apple] = await Promise.all([fetchAuthConfig(), appleAvailable()]);
      if (live) {
        setProviders({
          apple: apple && config.apple,
          google: config.google && googleAvailable(),
          dev: devAllowed && config.devAccount,
          reachable: config.reachable,
          checked: true,
          trialDays: config.trialDays ?? null,
        });
      }
    })();
    return () => {
      live = false;
    };
  }, [devAllowed, attempt]);

  const continueHref = mode === 'mechanic' ? '/mechanic/dashboard' : '/home';
  const canContinue = (signedIn || providers.dev) && onboarded;
  const canSignIn = providers.apple || providers.google;

  const getStarted = () => {
    setError(null);
    if (signedIn || providers.dev) {
      router.push('/onboarding/country');
      return;
    }
    if (canSignIn) {
      setSheet(true);
      return;
    }
    // Nothing to sign in with: say why instead of doing nothing.
    setError(
      !providers.reachable
        ? __DEV__
          ? `Can't reach the Carma server at ${serverAddress()}. Start it with "npm run dev" in admin/, and keep this phone on the same Wi-Fi as the computer.`
          : "Can't reach Carma. Check your connection and try again."
        : __DEV__
          ? 'The server offers no sign-in yet: add Google/Apple client ids, or run it with "npm run dev" for the demo account.'
          : 'Sign-in is not available right now. Try again in a moment.'
    );
    setAttempt((n) => n + 1);
  };

  const run = async (which: 'apple' | 'google') => {
    setBusy(which);
    setError(null);
    const outcome: SignInOutcome = which === 'apple' ? await signInWithApple() : await signInWithGoogle();
    setBusy(null);
    if (!outcome.ok) {
      if (!outcome.cancelled) setError(outcome.message ?? 'Sign-in failed. Try again.');
      return;
    }
    setSheet(false);
    // Returning on a new phone with a garage already: straight in. Otherwise the set-up flow.
    if (getUiState().onboarded) router.replace(continueHref);
    else router.push('/onboarding/country');
  };

  const trial = providers.trialDays ? `${providers.trialDays} DAYS FREE` : 'FREE TRIAL';

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
      <Image source={require('@/../assets/images/welcome-car.jpg')} style={styles.photo} contentFit="cover" contentPosition={{ left: '38%', top: '58%' }} />
      <View style={styles.brand}>
        <View style={styles.dot} />
        <T style={styles.brandText}>CARMA</T>
      </View>
      <View style={styles.hero}>
        <T variant="hero">Every vehicle has a history. Most of it gets lost.</T>
        <T variant="body" style={styles.sub}>
          Know exactly what your car costs you, and prove every service it has had when you sell it.
        </T>
        <View style={styles.stripes}>
          <View style={[styles.stripe, { backgroundColor: Colors.accent }]} />
          <View style={[styles.stripe, { backgroundColor: Colors.signal }]} />
          <View style={[styles.stripe, { backgroundColor: Colors.cta }]} />
        </View>
      </View>
      <View style={styles.foot}>
        {canContinue ? (
          <>
            <Button onPress={() => router.replace(continueHref)}>{firstName ? `Continue as ${firstName}` : 'Continue'}</Button>
            {signedIn ? (
              <Pressable hitSlop={8} onPress={() => void signOut()} style={styles.link}>
                <T variant="meta" color={Colors.body}>
                  Not you? Sign out
                </T>
              </Pressable>
            ) : null}
          </>
        ) : (
          <>
            <Button onPress={getStarted}>Get started</Button>
            {error ? (
              <T variant="meta" color={Colors.signal} center>
                {error}
              </T>
            ) : null}
            <T variant="eyebrow" color={Colors.body} center style={styles.trial}>
              {trial} · NO CARD TO START{'\n'}SUBSCRIBE AFTER THAT TO KEEP ADDING RECORDS
            </T>
            {!signedIn && canSignIn ? (
              <Pressable hitSlop={8} onPress={() => setSheet(true)} style={styles.link}>
                <T variant="meta" color={Colors.body}>
                  I already have an account
                </T>
              </Pressable>
            ) : null}
          </>
        )}
      </View>

      <OptionSheet
        visible={sheet}
        title="Continue to Carma"
        lede="Your garage is kept with your account, so it is there on any phone you sign in on."
        options={[]}
        onSelect={() => {}}
        onClose={() => setSheet(false)}
        footer={
          <View style={styles.sheetButtons}>
            {providers.apple ? (
              <AppleAuthentication.AppleAuthenticationButton
                buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
                buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                cornerRadius={28}
                style={styles.apple}
                onPress={() => void run('apple')}
              />
            ) : null}
            {providers.google ? (
              <Button variant="secondary" glyph="google" loading={busy === 'google'} disabled={!!busy} onPress={() => void run('google')}>
                Continue with Google
              </Button>
            ) : null}
            {error ? (
              <T variant="meta" color={Colors.signal} center>
                {error}
              </T>
            ) : null}
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  photo: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.14,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingHorizontal: Spacing.lg,
    paddingTop: 22,
  },
  dot: {
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: Colors.accent,
  },
  brandText: {
    fontSize: 10,
    letterSpacing: Tracking.brand,
    color: Colors.body,
  },
  hero: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
  },
  sub: {
    marginTop: Spacing.lg,
    maxWidth: 300,
  },
  stripes: {
    flexDirection: 'row',
    gap: 10,
    height: 8,
    marginTop: Spacing.xl,
  },
  stripe: {
    flex: 1,
  },
  foot: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl,
    paddingBottom: 14,
    gap: 14,
  },
  trial: {
    lineHeight: 16,
  },
  apple: {
    height: 56,
    width: '100%',
  },
  link: {
    alignSelf: 'center',
    paddingVertical: 4,
  },
  sheetButtons: {
    gap: 12,
  },
});
