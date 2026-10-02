/**
 * Tiny local UI-preference store — NOT domain data. Two things live here:
 * - `onboarded`: has this device finished the onboarding flow at least once.
 * - `activeGarageId`: which garage is currently selected in the UI.
 *
 * Neither of these has a server-side concept (there's no "onboarded" flag
 * or "current garage" on Account/Garage), so unlike everything else in
 * `@/data`, this intentionally keeps a small AsyncStorage-backed store —
 * the retirement of the mock data layer (`@/data/store`, the old
 * `useSyncExternalStore`-over-arrays pattern) was about DOMAIN data (garages,
 * vehicles, records, ...), not this kind of client-only device preference.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';

type UiState = {
  onboarded: boolean;
  activeGarageId: string | null;
  /** Which side of Carma this device is using: the owner garage or the mechanic workshop. */
  mode: 'owner' | 'mechanic';
  /** The vehicle the Home composer is scoped to (null = the whole garage). */
  homeVehicleId: string | null;
  /** The workshop the mechanic side is pointed at. */
  activeWorkshopId: string | null;
  /** Recent questions asked on Home, newest first (drawer "Recents"). */
  recents: string[];
  /** Recent questions asked on the workshop side, kept apart from the owner's. */
  mechanicRecents: string[];
  /** Notification preferences from My profile, keyed by topic. */
  notificationPrefs: Record<string, boolean>;
};

const STORAGE_KEY = 'carma:ui-state:v1';

let state: UiState = {
  onboarded: false,
  activeGarageId: null,
  mode: 'owner',
  homeVehicleId: null,
  activeWorkshopId: null,
  recents: [],
  mechanicRecents: [],
  notificationPrefs: {},
};
let hydrated = false;
let hydrating: Promise<void> | null = null;
const listeners = new Set<() => void>();

function notify() {
  for (const l of listeners) l();
}

async function persist() {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // best-effort; a UI preference, not worth surfacing a write failure for
  }
}

export function subscribeUiState(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getUiState(): UiState {
  return state;
}

export async function hydrateUiState(): Promise<void> {
  if (hydrated) return;
  if (hydrating) return hydrating;
  hydrating = (async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) state = { ...state, ...(JSON.parse(raw) as Partial<UiState>) };
    } catch {
      // fall back to defaults
    } finally {
      hydrated = true;
      notify();
    }
  })();
  return hydrating;
}

export function isUiHydrated(): boolean {
  return hydrated;
}

export async function setUiState(patch: Partial<UiState>): Promise<void> {
  state = { ...state, ...patch };
  notify();
  await persist();
}

export function useHydrateOnMount() {
  const ready = useSyncExternalStore(subscribeUiState, isUiHydrated, () => false);
  if (!ready) {
    void hydrateUiState();
  }
  return ready;
}

export function useOnboarded(): boolean {
  return useSyncExternalStore(subscribeUiState, () => getUiState().onboarded, () => false);
}

export function useActiveGarageId(): string | null {
  return useSyncExternalStore(subscribeUiState, () => getUiState().activeGarageId, () => null);
}

export function useUiState<K extends keyof UiState>(key: K): UiState[K] {
  return useSyncExternalStore(subscribeUiState, () => getUiState()[key], () => getUiState()[key]);
}

export function useMode(): UiState['mode'] {
  return useUiState('mode');
}

/** Adds a question to the drawer's Recents for the current mode, de-duplicated and capped at 20. */
export async function pushRecent(question: string): Promise<void> {
  const q = question.trim();
  if (!q) return;
  const key = state.mode === 'mechanic' ? 'mechanicRecents' : 'recents';
  await setUiState({ [key]: [q, ...state[key].filter((r) => r !== q)].slice(0, 20) });
}
