import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform, TurboModuleRegistry } from 'react-native';

import { api, ApiError } from '@/data/api/client';
import { clearSession, getSession, saveSession, type Session } from '@/data/auth/session';
import { queryClient } from '@/data/queryClient';
import { setUiState } from '@/data/uiState';
import { signOutOfStore } from '@/features/billing/store';
import { unregisterPush } from '@/features/notifications/push';
import { clearProgress } from '@/features/onboarding/progress';

/**
 * Sign in with Google or Apple, natively, then trade the provider's ID token
 * for a Carma session (POST /api/v1/auth/google | apple). The provider token
 * is never stored; only Carma's own session is (see @/data/auth/session).
 */

export type AuthConfig = { google: boolean; apple: boolean; devAccount: boolean; reachable: boolean; trialDays?: number | null };
export type SignInOutcome = { ok: true; isNew: boolean } | { ok: false; cancelled?: boolean; message?: string };

type SessionResponse = Session & { accountId: string; isNew: boolean };

export async function fetchAuthConfig(): Promise<AuthConfig> {
  try {
    return { ...(await api.get<Omit<AuthConfig, 'reachable'>>('auth/config')), reachable: true };
  } catch {
    return { google: false, apple: false, devAccount: false, reachable: false };
  }
}

/** The Google module is native: absent in Expo Go and on web. Loaded lazily so the app still starts there. */
type GoogleModule = typeof import('@react-native-google-signin/google-signin');
function loadGoogle(): GoogleModule | null {
  if (Platform.OS === 'web') return null;
  // Expo Go has no native Google module; loading the library there throws (and
  // shows a red error even when caught), so check before requiring it.
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) return null;
  if (!TurboModuleRegistry.get('RNGoogleSignin')) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('@react-native-google-signin/google-signin') as GoogleModule;
  } catch {
    return null;
  }
}

export function googleAvailable(): boolean {
  return !!process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID && !!loadGoogle();
}

export async function appleAvailable(): Promise<boolean> {
  if (Platform.OS !== 'ios') return false;
  try {
    return await AppleAuthentication.isAvailableAsync();
  } catch {
    return false;
  }
}

async function finish(res: SessionResponse): Promise<SignInOutcome> {
  await saveSession({
    accessToken: res.accessToken,
    accessTokenExpiresAt: res.accessTokenExpiresAt,
    refreshToken: res.refreshToken,
    refreshTokenExpiresAt: res.refreshTokenExpiresAt,
  });
  // A different person may have used this device before: drop every cached answer.
  queryClient.clear();
  if (!res.isNew) {
    // Returning on a new phone: if they already have a garage, skip set-up.
    const garages = await api.get<unknown[]>('garages').catch(() => []);
    if (garages.length > 0) await setUiState({ onboarded: true });
  } else {
    await setUiState({ onboarded: false, activeGarageId: null });
  }
  return { ok: true, isNew: res.isNew };
}

const messageOf = (e: unknown) => (e instanceof ApiError || e instanceof Error ? e.message : 'Sign-in failed. Try again.');

export async function signInWithGoogle(): Promise<SignInOutcome> {
  const g = loadGoogle();
  if (!g) return { ok: false, message: 'Google sign-in needs the Carma app build, not Expo Go.' };
  try {
    g.GoogleSignin.configure({
      webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
      iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || undefined,
    });
    if (Platform.OS === 'android') await g.GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const result = await g.GoogleSignin.signIn();
    if (!g.isSuccessResponse(result)) return { ok: false, cancelled: true };
    const idToken = result.data.idToken;
    if (!idToken) return { ok: false, message: 'Google did not return an ID token. Check the web client id.' };
    return finish(await api.post<SessionResponse>('auth/google', { idToken }));
  } catch (e) {
    if (g.isErrorWithCode(e) && e.code === g.statusCodes.SIGN_IN_CANCELLED) return { ok: false, cancelled: true };
    return { ok: false, message: messageOf(e) };
  }
}

export async function signInWithApple(): Promise<SignInOutcome> {
  try {
    // A one-time nonce: Apple signs its hash into the token, the server checks it against the raw value.
    const rawNonce = `${Crypto.randomUUID()}${Crypto.randomUUID()}`;
    const hashed = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL],
      nonce: hashed,
    });
    if (!credential.identityToken) return { ok: false, message: 'Apple did not return an identity token.' };
    const fullName = [credential.fullName?.givenName, credential.fullName?.familyName].filter(Boolean).join(' ') || undefined;
    return finish(await api.post<SessionResponse>('auth/apple', { identityToken: credential.identityToken, rawNonce, fullName }));
  } catch (e) {
    if ((e as { code?: string }).code === 'ERR_REQUEST_CANCELED') return { ok: false, cancelled: true };
    return { ok: false, message: messageOf(e) };
  }
}

/** Ends the session on the server and on this device, and forgets everything cached. */
export async function signOut(): Promise<void> {
  // Before the session ends: both calls need it.
  await unregisterPush();
  await signOutOfStore();
  const session = getSession();
  if (session) await api.post('auth/logout', { refreshToken: session.refreshToken }).catch(() => {});
  const g = loadGoogle();
  if (g) await g.GoogleSignin.signOut().catch(() => {});
  await clearSession();
  await clearProgress();
  await setUiState({ onboarded: false, activeGarageId: null, mode: 'owner', homeVehicleId: null, recents: [], mechanicRecents: [] });
  queryClient.clear();
}

/**
 * Deletes the signed-in account (App Store / Play account deletion). Ends
 * every session on the server, then signs out here. The server keeps the data
 * 30 days for mistakes, then removes it permanently.
 */
export async function deleteAccount(): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    await api.delete('account', { confirm: 'DELETE' });
  } catch (e) {
    return { ok: false, message: messageOf(e) };
  }
  await signOut();
  return { ok: true };
}
