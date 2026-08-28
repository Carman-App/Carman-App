import AsyncStorage from '@react-native-async-storage/async-storage';

import * as seed from '@/data/seed';
import { todayIso } from '@/lib/format';
import type {
  Account,
  AccessRequest,
  BuildStage,
  Estimate,
  Garage,
  GarageMember,
  InspectionReport,
  Invoice,
  Modification,
  PartLine,
  ProjectBuild,
  Reminder,
  Vehicle,
  VehicleDocument,
  VehicleRecord,
} from '@/types/domain';

export type CarmaState = {
  onboarded: boolean;
  activeGarageId: string | null;
  account: Account | null;
  garages: Garage[];
  members: GarageMember[];
  vehicles: Vehicle[];
  records: VehicleRecord[];
  documents: VehicleDocument[];
  reminders: Reminder[];
  projects: ProjectBuild[];
  stages: BuildStage[];
  modifications: Modification[];
  parts: PartLine[];
  estimates: Estimate[];
  invoices: Invoice[];
  inspections: InspectionReport[];
  accessRequests: AccessRequest[];
};

function emptyState(): CarmaState {
  return {
    onboarded: false,
    activeGarageId: null,
    account: null,
    garages: [],
    members: [],
    vehicles: [],
    records: [],
    documents: [],
    reminders: [],
    projects: [],
    stages: [],
    modifications: [],
    parts: [],
    estimates: [],
    invoices: [],
    inspections: [],
    accessRequests: [],
  };
}

function demoState(): CarmaState {
  return {
    onboarded: true,
    activeGarageId: seed.SEED_GARAGES[0].id,
    account: seed.SEED_ACCOUNT,
    garages: [...seed.SEED_GARAGES],
    members: [...seed.SEED_MEMBERS],
    vehicles: [...seed.SEED_VEHICLES],
    records: [...seed.SEED_RECORDS],
    documents: [...seed.SEED_DOCUMENTS],
    reminders: [...seed.SEED_REMINDERS],
    projects: [seed.SEED_PROJECT],
    stages: [...seed.SEED_BUILD_STAGES],
    modifications: [...seed.SEED_MODIFICATIONS],
    parts: [...seed.SEED_PARTS],
    estimates: [...seed.SEED_ESTIMATES],
    invoices: [...seed.SEED_INVOICES],
    inspections: [...seed.SEED_INSPECTIONS],
    accessRequests: [...seed.SEED_ACCESS_REQUESTS],
  };
}

const STORAGE_KEY = 'carma:v1:state';

/**
 * Backfills fields added to the schema after data may already have been
 * persisted on a device (this is a local-only mock store with no server-side
 * migration path). Currently: `Vehicle.createdAt` became required — old
 * persisted vehicles won't have it, so give them a sane fallback rather than
 * crashing every screen that reads it.
 */
function migrate(loaded: CarmaState): CarmaState {
  if (!loaded.vehicles) return loaded;
  return {
    ...loaded,
    vehicles: loaded.vehicles.map((v) => (v.createdAt ? v : { ...v, createdAt: todayIso() })),
  };
}

let state: CarmaState = emptyState();
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
    // best-effort persistence; mock data layer, safe to ignore write failures
  }
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getState(): CarmaState {
  return state;
}

export async function hydrate(): Promise<void> {
  if (hydrated) return;
  if (hydrating) return hydrating;
  hydrating = (async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        state = migrate(JSON.parse(raw) as CarmaState);
      }
    } catch {
      // fall back to empty state
    } finally {
      hydrated = true;
      notify();
    }
  })();
  return hydrating;
}

export function isHydrated() {
  return hydrated;
}

let idCounter = 1000;
export function nextId(prefix: string) {
  idCounter += 1;
  return `${prefix}-${idCounter}`;
}

export async function setState(updater: (draft: CarmaState) => void): Promise<void> {
  const draft = { ...state };
  updater(draft);
  state = draft;
  notify();
  await persist();
}

/** Loads the full demo dataset (3-vehicle garage with history) and marks onboarding complete. */
export async function loadDemoState(): Promise<void> {
  state = demoState();
  notify();
  await persist();
}

/** Wipes everything back to a logged-out, un-onboarded state. */
export async function resetAll(): Promise<void> {
  state = emptyState();
  notify();
  await persist();
}
