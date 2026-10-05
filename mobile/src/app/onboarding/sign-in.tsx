import * as AppleAuthentication from 'expo-apple-authentication';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { T } from '@/components/ui/Typography';
import { getUiState } from '@/data/uiState';
import { openLegal } from '@/features/auth/legal';
import { appleAvailable, fetchAuthConfig, googleAvailable, signInWithApple, signInWithGoogle, type SignInOutcome } from '@/features/auth/signIn';
import { OnboardingScreen } from '@/features/onboarding/OnboardingScreen';
import { Colors, Spacing } from '@/theme/tokens';

type Providers = { apple: boolean; google: boolean; devAccount: boolean; reachable: boolean };

/**
 * Sign in: Continue with Apple / Continue with Google. Get started on Welcome
 * opens this when nobody is signed in. A new account goes on to set-up; an
 * account that already has a garage goes straight home.
 *
 * Google needs a development or store build with the Google client ids;
 * Apple needs an iPhone build with Sign in with Apple. In development, when
 * neither is set up (Expo Go), the app can carry on with the test account.
 */
export default function SignInScreen() {
  const [providers, setProviders] = useState<Providers | null>(null);
  const [busy, setBusy] = useState<'apple' | 'google' | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    void (async () => {
      const [config, apple] = await Promise.all([fetchAuthConfig(), appleAvailable()]);
      const appleOn = apple && config.apple;
      // App Store 4.8: on iPhone, Google sign-in is offered only alongside Sign in with Apple.
      const googleOn = config.google && googleAvailable() && (Platform.OS !== 'ios' || appleOn);
      if (live) setProviders({ apple: appleOn, google: googleOn, devAccount: config.devAccount, reachable: config.reachable });
    })();
    return () => {
      live = false;
    };
  }, []);

  const proceed = () => {
    if (!getUiState().onboarded) router.replace('/onboarding/country');
    else router.replace(getUiState().mode === 'mechanic' ? '/mechanic/dashboard' : '/home');
  };

  const run = async (which: 'apple' | 'google') => {
    setBusy(which);
    setError(null);
    const outcome: SignInOutcome = which === 'apple' ? await signInWithApple() : await signInWithGoogle();
    setBusy(null);
    if (outcome.ok) proceed();
    else if (!outcome.cancelled) setError(outcome.message ?? 'Sign-in did not work. Try again.');
  };

  const none = providers && !providers.apple && !providers.google;
  const devFallback = __DEV__ && none && providers?.devAccount;

  return (
    <OnboardingScreen
      backLabel="BACK"
      title="Sign in to Carma"
      lede="Your records are kept in your account, so they are safe if you change or lose your phone."
      footer={
        <View style={styles.buttons}>
          {!providers ? <ActivityIndicator color={Colors.accent} /> : null}
          {providers?.apple ? (
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
              buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
              cornerRadius={28}
              style={styles.apple}
              onPress={() => void run('apple')}
            />
          ) : null}
          {providers?.google ? (
            <Button variant="secondary" glyph="google" loading={busy === 'google'} disabled={!!busy} onPress={() => void run('google')}>
              Continue with Google
            </Button>
          ) : null}
          {devFallback ? (
            <Button variant="secondary" onPress={proceed}>
              Continue without signing in
            </Button>
          ) : null}
          {error ? (
            <T variant="meta" color={Colors.signal} center>
              {error}
            </T>
          ) : null}
          <View style={styles.legal}>
            <T variant="small" color={Colors.body} center>
              By continuing you agree to the{' '}
            </T>
            <Pressable accessibilityRole="button" onPress={() => openLegal('terms')}>
              <T variant="small" color={Colors.accent}>
                Terms of use
              </T>
            </Pressable>
            <T variant="small" color={Colors.body}>
              {' '}and{' '}
            </T>
            <Pressable accessibilityRole="button" onPress={() => openLegal('privacy')}>
              <T variant="small" color={Colors.accent}>
                Privacy policy
              </T>
            </Pressable>
          </View>
        </View>
      }>
      {none ? (
        <T variant="body" color={Colors.body} style={styles.note}>
          {!providers?.reachable
            ? 'Carma could not reach its server. Check your connection and try again.'
            : __DEV__
              ? 'Development: Google and Apple sign-in need a development build with their ids set (see DEPLOY.md, Sign-in setup). In Expo Go you can continue with the test account.'
              : 'Sign-in is not available right now. Try again in a little while.'}
        </T>
      ) : null}
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  buttons: {
    gap: Spacing.md,
  },
  apple: {
    height: 56,
    width: '100%',
  },
  legal: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginTop: Spacing.xs,
  },
  note: {
    marginTop: Spacing.md,
  },
});
