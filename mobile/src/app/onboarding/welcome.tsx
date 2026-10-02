import * as AppleAuthentication from 'expo-apple-authentication';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { OptionSheet } from '@/components/ui/OptionSheet';
import { T } from '@/components/ui/Typography';
import { useSignedIn } from '@/data/auth/session';
import { useUiState } from '@/data/hooks';
import { getUiState } from '@/data/uiState';
import { appleAvailable, fetchAuthConfig, googleAvailable, signInWithApple, signInWithGoogle, type SignInOutcome } from '@/features/auth/signIn';
import { Colors, Spacing, Tracking } from '@/theme/tokens';

/**
 * Welcome, exactly as designed (screen 01): the promise, the three stripes
 * (Carma blue, signal red, yellow) and one Get started.
 * Get started leads into the set-up flow (Where are you based?), or Home if
 * this device is already set up. When the person is not signed in and Apple
 * or Google sign-in is available, it first opens a Continue with Apple /
 * Google sheet.
 */
export default function WelcomeScreen() {
  const signedIn = useSignedIn();
  const mode = useUiState('mode');
  const [busy, setBusy] = useState<'apple' | 'google' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sheet, setSheet] = useState(false);
  const [providers, setProviders] = useState({ apple: false, google: false });

  useEffect(() => {
    let live = true;
    void (async () => {
      const [config, apple] = await Promise.all([fetchAuthConfig(), appleAvailable()]);
      if (live) setProviders({ apple: apple && config.apple, google: config.google && googleAvailable() });
    })();
    return () => {
      live = false;
    };
  }, []);

  const home = mode === 'mechanic' ? '/mechanic/dashboard' : '/home';
  const next = () => (getUiState().onboarded ? router.replace(home) : router.push('/onboarding/country'));

  const getStarted = () => {
    if (!signedIn && (providers.apple || providers.google)) {
      setError(null);
      setSheet(true);
      return;
    }
    next();
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
    next();
  };

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
        <Button onPress={getStarted}>Get started</Button>
        <T variant="eyebrow" color={Colors.body} center style={styles.trial}>
          7 DAYS FREE · NO CARD TO START{'\n'}SUBSCRIBE AFTER THAT TO KEEP ADDING RECORDS
        </T>
      </View>

      <OptionSheet
        visible={sheet}
        title="Continue to Carma"
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
  sheetButtons: {
    gap: 12,
  },
});
