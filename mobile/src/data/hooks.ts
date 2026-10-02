/**
 * TanStack Query hooks over the real `/api/v1/*` API, replacing the old
 * `useSyncExternalStore`-over-local-mock-arrays pattern. Hook NAMES and
 * argument signatures are kept identical to the old mock-backed hooks
 * wherever the underlying data maps onto a single resource, so most call
 * sites only need to switch from treating the return value as data directly
 * to unwrapping it (typically via `@/components/data/QueryBoundary`, which
 * accepts exactly the `{data, isLoading, isError, error, refetch}` shape
 * every hook here returns).
 *
 * Three hooks are intentionally NOT query hooks and return plain values,
 * same as before — they're local UI preference, not server data:
 * `useHydrateOnMount`, `useOnboarded`, `useActiveGarageId` (see `@/data/uiState`).
 */
import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';

import { api } from '@/data/api/client';
import {
  fetchGarageDocuments,
  fetchGaragePendingAccessRequests,
  fetchGarageRecords,
  fetchGarageVehicles,
  fetchVehicleAccessRequests,
  fetchVehicleDocuments,
  fetchVehicleProject,
  fetchVehicleRecords,
} from '@/data/api/aggregates';
import {
  toAccount,
  toEstimate,
  toGarage,
  toGarageMember,
  toInspection,
  toInvoice,
  toReminder,
  toVehicle,
  type RawAccount,
  type RawEstimate,
  type RawGarage,
  type RawGarageMember,
  type RawInspection,
  type RawInvoice,
  type RawReminder,
  type RawVehicle,
} from '@/data/api/mappers';
import { queryClient } from '@/data/queryClient';
import { qk } from '@/data/queryKeys';
import { useActiveGarageId, useHydrateOnMount, useOnboarded } from '@/data/uiState';
import { setActiveCurrency, setActiveDistanceUnit, setActiveVolumeUnit } from '@/lib/format';
import { REGION_UNITS, type Modification, type PartLine, type VehicleDocument, type VehicleRecord } from '@/types/domain';

export { useHydrateOnMount, useOnboarded, useActiveGarageId };

const FULL_PAGE = { pageSize: 100 };

// ---------- Account ----------

export function useAccount() {
  return useQuery({
    queryKey: qk.account(),
    queryFn: () => api.get<RawAccount>('account').then(toAccount),
  });
}

/**
 * Keeps `@/lib/format`'s `formatMoney`/`formatDistance`/`formatVolume` in
 * sync with the account's region — the one place currency and distance/
 * volume units are decided (spec: region chosen once at sign-up drives units
 * for everything after). Mounted once at the app root (`src/app/_layout.tsx`)
 * so it applies before any screen formats an amount, distance, or volume.
 */
export function useSyncAccountCurrency(): void {
  const { data: account } = useAccount();
  useEffect(() => {
    if (account?.region) {
      const units = REGION_UNITS[account.region];
      setActiveCurrency(units.currency);
      setActiveDistanceUnit(units.distance);
      setActiveVolumeUnit(units.volume);
    }
  }, [account?.region]);
}

// ---------- Garages ----------

export function useGarages() {
  return useQuery({
    queryKey: qk.garages(),
    queryFn: () => api.get<RawGarage[]>('garages').then((rows) => rows.map(toGarage)),
  });
}

export function useGarage(garageId: string | undefined) {
  return useQuery({
    queryKey: qk.garage(garageId),
    queryFn: () => api.get<RawGarage>(`garages/${garageId}`).then(toGarage),
    enabled: !!garageId,
  });
}

/** The garage currently selected in the UI (see `@/data/uiState`), defaulting to the first garage when none is explicitly chosen. */
export function useActiveGarage() {
  const activeGarageId = useActiveGarageId();
  const garagesQuery = useGarages();
  const garages = garagesQuery.data;
  const data = garages ? (garages.find((g) => g.id === activeGarageId) ?? garages[0]) : undefined;
  return { ...garagesQuery, data };
}

export function useGarageMembers(garageId: string | undefined) {
  return useQuery({
    queryKey: qk.garageMembers(garageId),
    queryFn: () => api.get<RawGarageMember[]>(`garages/${garageId}/members`).then((rows) => rows.map(toGarageMember)),
    enabled: !!garageId,
  });
}

// ---------- Vehicles ----------

export function useVehicles(garageId: string | undefined) {
  return useQuery({
    queryKey: qk.vehicles(garageId),
    queryFn: () => fetchGarageVehicles(garageId!),
    enabled: !!garageId,
  });
}

export function useVehicle(vehicleId: string | undefined) {
  return useQuery({
    queryKey: qk.vehicle(vehicleId),
    queryFn: () => api.get<RawVehicle>(`vehicles/${vehicleId}`).then(toVehicle),
    enabled: !!vehicleId,
  });
}

// ---------- Records ----------

export function useRecords(vehicleId: string | undefined) {
  return useQuery({
    queryKey: qk.records(vehicleId),
    queryFn: () => fetchVehicleRecords(vehicleId!),
    enabled: !!vehicleId,
  });
}

export function useGarageRecords(garageId: string | undefined) {
  return useQuery({
    queryKey: qk.garageRecords(garageId),
    queryFn: () => fetchGarageRecords(garageId!),
    enabled: !!garageId,
  });
}

/**
 * There is no `GET /records/:id` endpoint. This looks the record up in
 * whatever `records`/`garageRecords` query data is already cached (from
 * whichever list screen the caller navigated from) rather than issuing a
 * new request — matching the old mock hook's instant, no-loading-state feel
 * for what is, in practice, always a "tap a row I just saw in a list" flow.
 * A cold deep link to a record with nothing cached yet resolves to
 * `undefined`, same as the mock store returning nothing for an unknown id;
 * screens already render a "not found" state for that case.
 */
export function useRecord(recordId: string | undefined) {
  return useQuery({
    queryKey: ['record', recordId] as const,
    queryFn: () => findCached<VehicleRecord>(['records', 'garageRecords'], recordId!),
    enabled: !!recordId,
  });
}

// ---------- Documents ----------

export function useDocuments(vehicleId: string | undefined) {
  return useQuery({
    queryKey: qk.documents(vehicleId),
    queryFn: () => fetchVehicleDocuments(vehicleId!),
    enabled: !!vehicleId,
  });
}

export function useGarageDocuments(garageId: string | undefined) {
  return useQuery({
    queryKey: qk.garageDocuments(garageId),
    queryFn: () => fetchGarageDocuments(garageId!),
    enabled: !!garageId,
  });
}

/** Same "no GET-by-id endpoint, read from an already-fetched list's cache" approach as `useRecord`. */
export function useDocument(documentId: string | undefined) {
  return useQuery({
    queryKey: ['document', documentId] as const,
    queryFn: () => findCached<VehicleDocument>(['documents', 'garageDocuments'], documentId!),
    enabled: !!documentId,
  });
}

// ---------- Reminders ----------

export function useReminders(vehicleId: string | undefined) {
  return useQuery({
    queryKey: qk.reminders(vehicleId),
    // The API's default (no ?resolved=true) already excludes resolved reminders, matching the old hook's filter.
    queryFn: () =>
      api.getPaginated<RawReminder>(`vehicles/${vehicleId}/reminders`, FULL_PAGE).then((r) => r.items.map(toReminder)),
    enabled: !!vehicleId,
  });
}

export function useGarageReminders(garageId: string | undefined) {
  return useQuery({
    queryKey: qk.garageReminders(garageId),
    queryFn: () =>
      api.getPaginated<RawReminder>(`garages/${garageId}/reminders`, FULL_PAGE).then((r) => r.items.map(toReminder)),
    enabled: !!garageId,
  });
}

// ---------- Project build ----------

export function useProject(vehicleId: string | undefined) {
  return useQuery({
    queryKey: qk.projects(vehicleId),
    queryFn: () => fetchVehicleProject(vehicleId!),
    enabled: !!vehicleId,
  });
}

/** See `@/data/api/aggregates`'s `seedStageCaches` — populated as a side effect of fetching a project, not fetched directly. */
export function useBuildStage(stageId: string | undefined) {
  return useQuery({
    queryKey: qk.buildStage(stageId),
    // `?? null`: React Query forbids a queryFn ever resolving `undefined`
    // (it throws "Query data cannot be undefined") — a stage visited
    // directly (not seeded via `seedStageCaches` from the Project overview
    // first) would otherwise crash instead of showing a "not found" state.
    queryFn: () => queryClient.getQueryData(qk.buildStage(stageId)) ?? null,
    enabled: !!stageId,
    staleTime: Infinity,
  });
}

export function useStageModifications(stageId: string | undefined) {
  return useQuery({
    queryKey: qk.stageModifications(stageId),
    queryFn: () => queryClient.getQueryData<Modification[]>(qk.stageModifications(stageId)) ?? [],
    enabled: !!stageId,
    staleTime: Infinity,
  });
}

export function useStageParts(stageId: string | undefined) {
  return useQuery({
    queryKey: qk.stageParts(stageId),
    queryFn: () => queryClient.getQueryData<PartLine[]>(qk.stageParts(stageId)) ?? [],
    enabled: !!stageId,
    staleTime: Infinity,
  });
}

// ---------- Estimates / invoices / inspections / access ----------

export function useEstimates(vehicleId: string | undefined) {
  return useQuery({
    queryKey: qk.estimates(vehicleId),
    queryFn: () =>
      api.getPaginated<RawEstimate>(`vehicles/${vehicleId}/estimates`, FULL_PAGE).then((r) => r.items.map(toEstimate)),
    enabled: !!vehicleId,
  });
}

export function useEstimate(estimateId: string | undefined) {
  return useQuery({
    queryKey: qk.estimate(estimateId),
    queryFn: () => api.get<RawEstimate>(`estimates/${estimateId}`).then(toEstimate),
    enabled: !!estimateId,
  });
}

export function useInvoices(vehicleId: string | undefined) {
  return useQuery({
    queryKey: qk.invoices(vehicleId),
    queryFn: () =>
      api.getPaginated<RawInvoice>(`vehicles/${vehicleId}/invoices`, FULL_PAGE).then((r) => r.items.map(toInvoice)),
    enabled: !!vehicleId,
  });
}

export function useInvoice(invoiceId: string | undefined) {
  return useQuery({
    queryKey: qk.invoice(invoiceId),
    queryFn: () => api.get<RawInvoice>(`invoices/${invoiceId}`).then(toInvoice),
    enabled: !!invoiceId,
  });
}

export function useInspections(vehicleId: string | undefined) {
  return useQuery({
    queryKey: qk.inspections(vehicleId),
    queryFn: () =>
      api.getPaginated<RawInspection>(`vehicles/${vehicleId}/inspections`, FULL_PAGE).then((r) => r.items.map(toInspection)),
    enabled: !!vehicleId,
  });
}

export function useInspection(inspectionId: string | undefined) {
  return useQuery({
    queryKey: qk.inspection(inspectionId),
    queryFn: () => api.get<RawInspection>(`inspections/${inspectionId}`).then(toInspection),
    enabled: !!inspectionId,
  });
}

export function useAccessRequests(vehicleId: string | undefined) {
  return useQuery({
    queryKey: qk.accessRequests(vehicleId),
    queryFn: () => fetchVehicleAccessRequests(vehicleId!),
    enabled: !!vehicleId,
  });
}

export function usePendingAccessRequests(garageId: string | undefined) {
  return useQuery({
    queryKey: ['pendingAccessRequests', garageId] as const,
    queryFn: () => fetchGaragePendingAccessRequests(garageId!),
    enabled: !!garageId,
  });
}

// ---------- Insights ----------

/**
 * `GET vehicles/:id/insights` — computed server-side (see
 * admin/src/app/api/v1/vehicles/[id]/insights/route.ts): running cost,
 * cost/km, category breakdown and month-by-month totals, all over this
 * vehicle's full history (no period param — unlike the old mock screen's
 * client-side month/lastMonth/ytd filtering). Money fields are plain
 * `Number(...)` server-side (not Prisma Decimals), so no `toAmount()`
 * conversion is needed here, unlike most of `mappers.ts`. There's no domain
 * type for this in `@/types/domain` (the mock computed it ad hoc from
 * records) so the raw shape is used directly rather than adding a mapper.
 */
export type RawInsights = {
  runningCost: number;
  costPerKm: number | null;
  distanceTraveled: number | null;
  categoryBreakdown: {
    fuel: number;
    service: number;
    repair: number;
    expense: number;
    expenseByCategory: Record<string, number>;
  };
  monthByMonth: { month: string; total: number }[];
};

export function useInsights(vehicleId: string | undefined) {
  return useQuery({
    queryKey: qk.insights(vehicleId),
    queryFn: () => api.get<RawInsights>(`vehicles/${vehicleId}/insights`),
    enabled: !!vehicleId,
  });
}

// ---------- Admin-authored reference config ----------

/**
 * A published (isLive: true) Country row from the admin Config console — see
 * admin/src/app/api/v1/config/countries/route.ts and
 * admin/prisma/schema.prisma's Country model. `code` is a free-form ISO
 * alpha-2 string on the admin side, not constrained to mobile's 66-value
 * `Region` union, so a fetched row's `code` may or may not match a `Region`
 * the rest of the app understands (see country.tsx for how that's handled).
 */
export type RawConfigCountry = {
  id: string;
  code: string;
  name: string;
  currencyCode: string;
  currencySymbol: string;
  currencySymbolPlacement: 'BEFORE' | 'AFTER';
  distanceUnit: 'KM' | 'MI';
  volumeUnit: 'LITRE' | 'GALLON';
  dateFormat: string;
  flagEmoji: string | null;
  isLive: boolean;
};

/**
 * Live countries authored in the admin Config console. `staleTime: Infinity`
 * (never automatically refetched, only on explicit invalidation or app
 * restart) because this is reference data that changes rarely — at most once
 * per app session is the literal ask, and Infinity is the most direct way to
 * express that with TanStack Query. Callers MUST treat loading/error/empty
 * as "fall back to the hardcoded list" — this hook deliberately does not
 * throw or swallow errors itself, it just surfaces normal
 * isLoading/isError/data so each call site can decide its own fallback.
 */
export function useConfigCountries() {
  return useQuery({
    queryKey: qk.configCountries(),
    queryFn: () => api.getPaginated<RawConfigCountry>('config/countries', FULL_PAGE).then((r) => r.items),
    staleTime: Infinity,
    gcTime: 12 * 60 * 60 * 1000, // 12h — keep it around across a cold app relaunch within the same day
  });
}

/** A single active ConfigListItem — see admin/src/app/api/v1/config/lists/[key]/route.ts. */
export type RawConfigListItem = {
  id: string;
  listId: string;
  code: string;
  label: string;
  sortOrder: number;
  metadata: unknown;
  isActive: boolean;
};

/** Same rarely-changes reasoning as `useConfigCountries` — see its comment. */
export function useConfigList(key: string) {
  return useQuery({
    queryKey: qk.configList(key),
    queryFn: () => api.get<RawConfigListItem[]>(`config/lists/${key}`),
    staleTime: Infinity,
    gcTime: 12 * 60 * 60 * 1000,
  });
}

// ---------- internal ----------

// React Query forbids a queryFn ever resolving `undefined` (it throws "Query
// data cannot be undefined") — `null` is the correct "not found" value.
function findCached<T extends { id: string }>(keyPrefixes: string[], id: string): T | null {
  for (const prefix of keyPrefixes) {
    const entries = queryClient.getQueriesData<T[]>({ queryKey: [prefix] });
    for (const [, data] of entries) {
      const found = data?.find((item) => item.id === id);
      if (found) return found;
    }
  }
  return null;
}
