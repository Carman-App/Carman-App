import * as WebBrowser from 'expo-web-browser';

import { serverAddress } from '@/data/api/client';

/**
 * The public privacy, terms and account-deletion pages (served by the admin
 * server at /legal/*). EXPO_PUBLIC_LEGAL_BASE_URL points them at a separate
 * website if you host them elsewhere.
 */
export type LegalPage = 'privacy' | 'terms' | 'delete-account';

export function legalUrl(page: LegalPage): string {
  const base = (process.env.EXPO_PUBLIC_LEGAL_BASE_URL || serverAddress()).replace(/\/$/, '');
  return `${base}/legal/${page}`;
}

export function openLegal(page: LegalPage): void {
  void WebBrowser.openBrowserAsync(legalUrl(page));
}
