import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Development only: which test account (admin `npm run test-accounts`) this
 * device acts as when nobody is signed in. Overrides EXPO_PUBLIC_DEV_ACCOUNT_ID.
 * Chosen in My profile → Test accounts; production builds never send it.
 */

const KEY = 'carma:test-account:v1';
let current: string | null = null;
let loading: Promise<string | null> | null = null;

export function loadTestAccount(): Promise<string | null> {
  if (!__DEV__) return Promise.resolve(null);
  loading ??= AsyncStorage.getItem(KEY)
    .then((v) => (current = v))
    .catch(() => null);
  return loading;
}

export function getTestAccountId(): string | null {
  return __DEV__ ? current : null;
}

export async function setTestAccountId(id: string | null): Promise<void> {
  current = id;
  loading = Promise.resolve(id);
  try {
    if (id) await AsyncStorage.setItem(KEY, id);
    else await AsyncStorage.removeItem(KEY);
  } catch {
    // kept in memory for this run
  }
}
