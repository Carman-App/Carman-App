import { api } from '@/data/api/client';
import { getUiState, setUiState } from '@/data/uiState';

/** Must match TERMS_VERSION on the server (admin/src/lib/legal.ts). */
export const TERMS_VERSION = '2026-10';

/**
 * Records that this person accepted the Terms and Privacy Policy (PRIV-01).
 * Set-up's Country step says continuing means agreeing; this stores when, for
 * which version, from which device. Safe to call again: it only posts once
 * per version, and retries at the end of set-up if the first try failed.
 */
export async function recordConsent(): Promise<void> {
  if (getUiState().consentVersion === TERMS_VERSION) return;
  try {
    await api.post('account/consents', { termsVersion: TERMS_VERSION, source: 'mobile_onboarding', purposes: { essential: true } });
    await setUiState({ consentVersion: TERMS_VERSION });
  } catch {
    // Offline or not reachable: completeOnboarding tries again.
  }
}

/** GROW-02: how this account arrived. The server only fills it when it is still unknown. */
export async function stampSignupSource(source: 'STORE' | 'INVITE' | 'MECHANIC_LINK' | 'CAMPAIGN' = 'STORE'): Promise<void> {
  await api.patch('account', { signupSource: source }).catch(() => undefined);
}
