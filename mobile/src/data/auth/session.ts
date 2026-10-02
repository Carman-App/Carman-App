import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { useSyncExternalStore } from 'react';

/**
 * The signed-in session: a short-lived access token sent on every API call
 * and a long-lived refresh token that buys new ones. Stored in the device
 * keychain/keystore (expo-secure-store). On web, where there is no secure
 * store, AsyncStorage (localStorage) is used; web is a development target.
 *
 * Storage only. Refreshing lives in @/data/api/client, which owns the network.
 */

export type Session = {
  accessToken: string;
  accessTokenExpiresAt: string;
  refreshToken: string;
  refreshTokenExpiresAt: string;
};

const KEY = 'carma.session.v1';
let current: Session | null = null;
let loaded = false;
const listeners = new Set<() => void>();

const store = {
  get: (): Promise<string | null> => (Platform.OS === 'web' ? AsyncStorage.getItem(KEY) : SecureStore.getItemAsync(KEY)),
  set: (v: string): Promise<void> => (Platform.OS === 'web' ? AsyncStorage.setItem(KEY, v) : SecureStore.setItemAsync(KEY, v)),
  del: (): Promise<void> => (Platform.OS === 'web' ? AsyncStorage.removeItem(KEY) : SecureStore.deleteItemAsync(KEY)),
};

function notify() {
  for (const l of listeners) l();
}

export async function loadSession(): Promise<Session | null> {
  if (loaded) return current;
  try {
    const raw = await store.get();
    current = raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    current = null;
  }
  // A refresh token past its expiry cannot be used; treat as signed out.
  if (current && new Date(current.refreshTokenExpiresAt).getTime() < Date.now()) current = null;
  loaded = true;
  notify();
  return current;
}

export function getSession(): Session | null {
  return current;
}

export async function saveSession(s: Session): Promise<void> {
  current = s;
  loaded = true;
  notify();
  try {
    await store.set(JSON.stringify(s));
  } catch {
    // Keychain unavailable: the session still works until the app restarts.
  }
}

export async function clearSession(): Promise<void> {
  current = null;
  loaded = true;
  notify();
  try {
    await store.del();
  } catch {
    // nothing to remove
  }
}

export function subscribeSession(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

/** True when this device holds a session. Re-renders on sign-in and sign-out. */
export function useSignedIn(): boolean {
  return useSyncExternalStore(subscribeSession, () => !!current, () => false);
}

export function useSessionLoaded(): boolean {
  return useSyncExternalStore(subscribeSession, () => loaded, () => false);
}
