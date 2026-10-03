import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Linking, Platform } from 'react-native';

import { api, ApiError } from '@/data/api/client';
import { queryClient } from '@/data/queryClient';
import { qk } from '@/data/queryKeys';

/**
 * In-app subscriptions through App Store / Google Play billing, using
 * RevenueCat's SDK. The app only buys; the server decides what the account
 * has by reading the purchase from RevenueCat (POST billing/sync), so the
 * plan shown always comes from the account.
 *
 * Needs EXPO_PUBLIC_REVENUECAT_IOS_KEY / EXPO_PUBLIC_REVENUECAT_ANDROID_KEY
 * (RevenueCat → Project → API keys, the public app-specific keys) and a
 * development or store build. In Expo Go, or without keys, plans are shown
 * without a buy button.
 */

type PurchasesModule = typeof import('react-native-purchases');
export type StoreProduct = import('react-native-purchases').PurchasesStoreProduct;

let mod: PurchasesModule | null | undefined;
function load(): PurchasesModule | null {
  if (mod !== undefined) return mod;
  const key = apiKey();
  if (!key || Platform.OS === 'web' || Constants.executionEnvironment === ExecutionEnvironment.StoreClient) return (mod = null);
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    mod = require('react-native-purchases') as PurchasesModule;
  } catch {
    mod = null;
  }
  return mod;
}

function apiKey(): string | undefined {
  return Platform.OS === 'ios' ? process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY : process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY;
}

export function storeAvailable(): boolean {
  return load() !== null;
}

let sdkConfigured = false;
let configuredFor: string | null = null;

/** Signs RevenueCat in as this Carma account, so purchases belong to it. */
async function ensureConfigured(accountId: string): Promise<PurchasesModule | null> {
  const m = load();
  if (!m) return null;
  const Purchases = m.default;
  if (!sdkConfigured) {
    Purchases.configure({ apiKey: apiKey()!, appUserID: accountId });
    sdkConfigured = true;
  } else if (configuredFor !== accountId) {
    await Purchases.logIn(accountId);
  }
  configuredFor = accountId;
  return m;
}

/** The store's own products (localized price and period) for these ids. */
export async function loadProducts(accountId: string, productIds: string[]): Promise<StoreProduct[]> {
  if (productIds.length === 0) return [];
  const m = await ensureConfigured(accountId);
  if (!m) return [];
  return m.default.getProducts(productIds, m.PRODUCT_CATEGORY.SUBSCRIPTION);
}

/** Asks the server to read the account's purchases from the store, then refreshes the plan. */
async function syncWithServer(): Promise<void> {
  await api.post('billing/sync');
  await queryClient.invalidateQueries({ queryKey: qk.account() });
}

export type BuyOutcome = { ok: true } | { ok: false; cancelled?: boolean; message?: string };

function message(e: unknown): string {
  if (e instanceof ApiError) return e.message;
  return (e as { message?: string })?.message ?? 'Something went wrong. Try again.';
}

/** Buys (or switches to) a product. `currentProductId` lets Google Play replace the old subscription. */
export async function buy(accountId: string, product: StoreProduct, currentProductId: string | null): Promise<BuyOutcome> {
  const m = await ensureConfigured(accountId);
  if (!m) return { ok: false, message: 'Purchases are available in the App Store and Google Play versions of Carma.' };
  try {
    const change =
      Platform.OS === 'android' && currentProductId && currentProductId.split(':')[0] !== product.identifier.split(':')[0]
        ? { oldProductIdentifier: currentProductId.split(':')[0] }
        : null;
    await m.default.purchaseStoreProduct(product, change);
  } catch (e) {
    if ((e as { userCancelled?: boolean }).userCancelled) return { ok: false, cancelled: true };
    return { ok: false, message: message(e) };
  }
  try {
    await syncWithServer();
  } catch (e) {
    // Paid, but the server could not confirm yet: RevenueCat's webhook will.
    return { ok: false, message: `Payment received. Your plan will update shortly (${message(e)}).` };
  }
  return { ok: true };
}

/** Restore purchases (required by the App Store): re-links earlier purchases to this account. */
export async function restore(accountId: string): Promise<BuyOutcome> {
  const m = await ensureConfigured(accountId);
  if (!m) return { ok: false, message: 'Purchases are available in the App Store and Google Play versions of Carma.' };
  try {
    await m.default.restorePurchases();
    await syncWithServer();
    return { ok: true };
  } catch (e) {
    return { ok: false, message: message(e) };
  }
}

/** Opens the store's subscription settings, where people change or cancel. */
export async function manageSubscription(accountId: string): Promise<void> {
  const m = await ensureConfigured(accountId).catch(() => null);
  if (m) {
    try {
      await m.default.showManageSubscriptions();
      return;
    } catch {
      // fall through to the store's web page
    }
  }
  await Linking.openURL(Platform.OS === 'ios' ? 'https://apps.apple.com/account/subscriptions' : 'https://play.google.com/store/account/subscriptions');
}

/** On sign-out: the next person on this phone must not see these purchases. */
export async function signOutOfStore(): Promise<void> {
  if (!configuredFor) return;
  configuredFor = null;
  await load()?.default.logOut().catch(() => {});
}

/** "/ month", "/ year" from an ISO 8601 period (P1M, P1Y, P3M…). */
export function periodLabel(iso: string | null | undefined): string {
  if (!iso) return '';
  const m = iso.match(/^P(\d+)([DWMY])$/);
  if (!m) return '';
  const unit = { D: 'day', W: 'week', M: 'month', Y: 'year' }[m[2] as 'D' | 'W' | 'M' | 'Y'];
  return m[1] === '1' ? `/ ${unit}` : `/ ${m[1]} ${unit}s`;
}
