import * as AppleAuthentication from 'expo-apple-authentication';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { T } from '@/components/ui/Typography';
import { useSignedIn } from '@/data/auth/session';
import { useAccount, useOnboarded, useUiState } from '@/data/hooks';
import { appleAvailable, fetchAuthConfig, googleAvailable, signInWithApple, signInWithGoogle, signOut, type SignInOutcome } from '@/features/auth/signIn';
import { Colors, Spacing, Tracking } from '@/theme/tokens';

/**
 * Welcome. Sign in with Apple or Google; the three stripes are the Carma
 * blue, signal red and yellow. Signed in already: carry on, or finish set-up.
 * In development only, a demo account can be used without signing in.
 */
export default function WelcomeScreen() {
  const signedIn = useSignedIn();
  const onboarded = useOnboarded();
  const mode = useUiState('mode');
  const [busy, setBusy] = useState<'apple' | 'google' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [providers, setProviders] = useState({ apple: false, google: false, dev: false });
  const devAllowed = __DEV__ && !!process.env.EXPO_PUBLIC_DEV_ACCOUNT_ID;
  // With no session, the account is only knowable through the development demo account.
  const account = useAccount().data;
  const firstName = signedIn || providers.dev ? account?.name?.split(' ')[0] : undefined;

  useEffect(() => {
    let live = true;
    void (async () => {
      const [config, apple] = await Promise.all([fetchAuthConfig(), appleAvailable()]);
      if (live) setProviders({ apple: apple && config.apple, google: config.google && googleAvailable(), dev: devAllowed && config.devAccount });
    })();
    return () => {
      live = false;
    };
  }, [devAllowed]);

  const run = async (which: 'apple' | 'google') => {
    setBusy(which);
    setError(null);
    const outcome: SignInOutcome = which === 'apple' ? await signInWithApple() : await signInWithGoogle();
    setBusy(null);
    if (!outcome.ok) {
      if (!outcome.cancelled) setError(outcome.message ?? 'Sign-in failed. Try again.');
      return;
    }
    router.replace('/');
  };

  const continueHref = mode === 'mechanic' ? '/mechanic/dashboard' : '/home';
  const canContinue = (signedIn || providers.dev) && onboarded;

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
        ) : signedIn ? (
          <Button onPress={() => router.push('/onboarding/country')}>Set up my garage</Button>
        ) : (
          <>
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
            {providers.dev ? (
              <Button variant={providers.apple || providers.google ? 'ghost' : 'primary'} onPress={() => router.push('/onboarding/country')}>
                Use the demo account (development)
              </Button>
            ) : null}
            {!providers.apple && !providers.google && !providers.dev ? (
              <T variant="meta" color={Colors.body} center>
                Sign-in is not available right now. Check your connection and reopen Carma.
              </T>
            ) : null}
            {error ? (
              <T variant="meta" color={Colors.signal} center>
                {error}
              </T>
            ) : null}
            <T variant="eyebrow" color={Colors.body} center style={styles.trial}>
              FREE TRIAL · NO CARD TO START{'\n'}YOUR RECORDS STAY READABLE WHEN IT ENDS
            </T>
          </>
        )}
      </View>
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
});
