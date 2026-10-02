import AsyncStorage from '@react-native-async-storage/async-storage';

import { getUiState } from '@/data/uiState';
import type { OnboardingDraft } from '@/features/onboarding/context';

/**
 * Set-up progress kept on the device: the answers so far and the step the
 * person was on. If the app closes before set-up is finished, the next
 * launch reopens that step with the answers filled in. Cleared when set-up
 * completes or the person signs out.
 */

const KEY = 'carma:onboarding-progress:v1';

export type OnboardingProgress = { step: string; draft: OnboardingDraft; savedAt: string };

/** Steps worth resuming: everything after Welcome and before the finish screens. */
export function isResumableStep(path: string): boolean {
  return path.startsWith('/onboarding/') && !['/onboarding/welcome', '/onboarding/vehicle-added', '/onboarding/first-job'].includes(path);
}

export async function loadProgress(): Promise<OnboardingProgress | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as OnboardingProgress) : null;
  } catch {
    return null;
  }
}

export async function saveProgress(p: Omit<OnboardingProgress, 'savedAt'>): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify({ ...p, savedAt: new Date().toISOString() }));
  } catch {
    // best effort: losing it only means starting set-up again
  }
}

export async function clearProgress(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {
    // nothing to clear
  }
}

/** Where a launch should open: the unfinished set-up step, else Welcome. */
export async function launchTarget(): Promise<string> {
  if (!getUiState().onboarded) {
    const p = await loadProgress();
    if (p && isResumableStep(p.step)) return p.step;
  }
  return '/onboarding/welcome';
}
