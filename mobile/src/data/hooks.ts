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
import { useQueries, useQuery } from '@tanstack/react-query';

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
import { setUiState, useActiveGarageId, useHydrateOnMount, useOnboarded, useUiState } from '@/data/uiState';
import { REGION_UNITS, type Modification, type PartLine, type VehicleDocument, type VehicleRecord } from '@/types/domain';

export { useHydrateOnMount, useOnboarded, useActiveGarageId, useUiState };

const FULL_PAGE = { pageSize: 100 };

// ---------- Account ----------

export function useAccount() {
  return useQuery({
    queryKey: qk.account(),
    queryFn: () => api.get<RawAccount>('account').then(toAccount),
  });
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

// ---------- Notifications ----------

export type AppNotification = {
  id: string;
  type: string;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
};

export function useNotifications() {
  return useQuery({
    queryKey: qk.notifications(),
    queryFn: () => api.getPaginated<AppNotification>('notifications', FULL_PAGE).then((r) => r.items),
  });
}

export async function markNotificationRead(id: string) {
  await api.post(`notifications/${id}/read`);
  await queryClient.invalidateQueries({ queryKey: qk.notifications() });
}

// ---------- Garage-wide estimates (Home approval line) ----------

/**
 * Pending estimates across every vehicle in a garage. There is no
 * garage-level estimates endpoint, so this fans out over the vehicles'
 * own lists (each cached under its normal `qk.estimates` key).
 */
export function usePendingEstimates(vehicleIds: string[]) {
  return useQueries({
    queries: vehicleIds.map((id) => ({
      queryKey: qk.estimates(id),
      queryFn: () =>
        api.getPaginated<RawEstimate>(`vehicles/${id}/estimates`, FULL_PAGE).then((r) => r.items.map(toEstimate)),
    })),
    combine: (results) => ({
      data: results.flatMap((r) => r.data ?? []).filter((e) => e.status === 'pending'),
      isLoading: results.some((r) => r.isLoading),
    }),
  });
}

// ---------- Workshop (mechanic side) ----------

export type JobStatus =
  | 'INTAKE'
  | 'AWAITING_APPROVAL'
  | 'APPROVED'
  | 'IN_PROGRESS'
  | 'READY_FOR_COLLECTION'
  | 'INVOICED'
  | 'PARTIALLY_PAID'
  | 'PAID'
  | 'DECLINED'
  | 'CANCELLED';

export type JobLineKind = 'PART' | 'LABOUR' | 'SERVICE' | 'FLUID';

export type Workshop = { id: string; name: string; verifiedBadge?: boolean; createdAt: string };
export type WorkshopCustomer = { id: string; name: string; phone: string | null; notes: string | null; createdAt: string };
export type JobLine = { id: string; kind: JobLineKind; description: string; cost: number; createdAt: string };
export type Job = {
  id: string;
  workshopId: string;
  customerId: string;
  vehicleId: string | null;
  vehicleDescription: string | null;
  faultDescription: string;
  status: JobStatus;
  createdAt: string;
  updatedAt: string;
  customer?: WorkshopCustomer;
  lines: JobLine[];
};

type RawJobLine = Omit<JobLine, 'cost'> & { cost: string | number };
type RawJob = Omit<Job, 'lines'> & { lines?: RawJobLine[] };

function toJob(raw: RawJob): Job {
  return { ...raw, lines: (raw.lines ?? []).map((l) => ({ ...l, cost: Number(l.cost) })) };
}

export function useWorkshops() {
  return useQuery({
    queryKey: ['workshops'] as const,
    queryFn: () => api.get<Workshop[]>('workshops'),
  });
}

/** The workshop the mechanic side is pointed at, defaulting to the first one. */
export function useActiveWorkshop() {
  const activeId = useUiState('activeWorkshopId');
  const q = useWorkshops();
  const data = q.data ? (q.data.find((w) => w.id === activeId) ?? q.data[0] ?? null) : undefined;
  return { ...q, data };
}

export function useJobs(workshopId: string | undefined) {
  return useQuery({
    queryKey: ['jobs', workshopId] as const,
    queryFn: () => api.getPaginated<RawJob>(`workshops/${workshopId}/jobs`, FULL_PAGE).then((r) => r.items.map(toJob)),
    enabled: !!workshopId,
  });
}

export function useJob(jobId: string | undefined) {
  return useQuery({
    queryKey: ['job', jobId] as const,
    queryFn: () => api.get<RawJob>(`jobs/${jobId}`).then(toJob),
    enabled: !!jobId,
  });
}

export function useWorkshopCustomers(workshopId: string | undefined) {
  return useQuery({
    queryKey: ['workshopCustomers', workshopId] as const,
    queryFn: () => api.getPaginated<WorkshopCustomer>(`workshops/${workshopId}/customers`, FULL_PAGE).then((r) => r.items),
    enabled: !!workshopId,
  });
}

async function invalidateWorkshop(workshopId?: string, jobId?: string) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ['workshops'] }),
    workshopId ? queryClient.invalidateQueries({ queryKey: ['jobs', workshopId] }) : null,
    workshopId ? queryClient.invalidateQueries({ queryKey: ['workshopCustomers', workshopId] }) : null,
    jobId ? queryClient.invalidateQueries({ queryKey: ['job', jobId] }) : null,
  ]);
}

export async function createWorkshop(name: string) {
  const w = await api.post<Workshop>('workshops', { name });
  await setUiState({ activeWorkshopId: w.id });
  await invalidateWorkshop();
  return w;
}

export async function createWorkshopCustomer(workshopId: string, input: { name: string; phone?: string; notes?: string }) {
  const c = await api.post<WorkshopCustomer>(`workshops/${workshopId}/customers`, input);
  await invalidateWorkshop(workshopId);
  return c;
}

export async function createJob(
  workshopId: string,
  input: { customerId: string; vehicleId?: string; vehicleDescription?: string; faultDescription: string }
) {
  const job = await api.post<RawJob>(`workshops/${workshopId}/jobs`, input);
  await invalidateWorkshop(workshopId);
  return toJob(job);
}

export async function addJobLine(job: Job, input: { kind: JobLineKind; description: string; cost: number }) {
  await api.post(`jobs/${job.id}/lines`, input);
  await invalidateWorkshop(job.workshopId, job.id);
}

export async function setJobStatus(job: Job, status: JobStatus) {
  await api.post(`jobs/${job.id}/status`, { status });
  await invalidateWorkshop(job.workshopId, job.id);
}

/** The account's currency code (from its region), defaulting to KES while loading. */
export function useCurrency() {
  const account = useAccount().data;
  return account ? (REGION_UNITS[account.region]?.currency ?? 'KES') : 'KES';
}
