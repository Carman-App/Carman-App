/**
 * Composite fetchers that don't map onto a single `/api/v1/*` endpoint —
 * either because the real API deliberately splits data across per-type
 * tables/routes (records), or because there's no garage-level aggregate
 * endpoint for something vehicle-scoped (records, documents). Kept separate
 * from `@/data/hooks` so the network shape (how many requests, how they're
 * merged) is easy to find and change without wading through hook definitions.
 */
import { api } from '@/data/api/client';
import { queryClient } from '@/data/queryClient';
import { qk } from '@/data/queryKeys';
import {
  RECORD_TYPES,
  toAccessRequest,
  toDocument,
  toExpenseRecord,
  toFuelRecord,
  toModification,
  toOdometerRecord,
  toPart,
  toProject,
  toServiceOrRepairRecord,
  toStage,
  toVehicle,
  type RawAccessRequest,
  type RawDocument,
  type RawExpenseRecord,
  type RawFuelRecord,
  type RawOdometerReading,
  type RawProject,
  type RawServiceRepairRecord,
  type RawVehicle,
} from '@/data/api/mappers';
import type { AccessRequest, ProjectBuild, Vehicle, VehicleDocument, VehicleRecord } from '@/types/domain';

const FULL_PAGE = { pageSize: 100 };

/**
 * The untyped `GET /vehicles/:id/records` merged feed collapses every
 * record's distinguishing fields (litres, category, place, notes,
 * odometerAtEntry) into a single `description` string server-side (see
 * admin/src/lib/records.ts's getRecordsFeed) — fine for a dashboard preview,
 * but not enough to populate an edit screen. So instead this fetches each
 * of the five typed record lists (which return full rows) in parallel and
 * merges them client-side, matching what the mock data layer's flat
 * `VehicleRecord[]` always gave screens.
 */
export async function fetchVehicleRecords(vehicleId: string): Promise<VehicleRecord[]> {
  const [fuel, service, repair, expense, odometer] = await Promise.all([
    api.getPaginated<RawFuelRecord>(`vehicles/${vehicleId}/records`, { type: 'fuel', ...FULL_PAGE }),
    api.getPaginated<RawServiceRepairRecord>(`vehicles/${vehicleId}/records`, { type: 'service', ...FULL_PAGE }),
    api.getPaginated<RawServiceRepairRecord>(`vehicles/${vehicleId}/records`, { type: 'repair', ...FULL_PAGE }),
    api.getPaginated<RawExpenseRecord>(`vehicles/${vehicleId}/records`, { type: 'expense', ...FULL_PAGE }),
    api.getPaginated<RawOdometerReading>(`vehicles/${vehicleId}/records`, { type: 'odometer', ...FULL_PAGE }),
  ]);

  const merged: VehicleRecord[] = [
    ...fuel.items.map(toFuelRecord),
    ...service.items.map((r) => toServiceOrRepairRecord(r, 'service')),
    ...repair.items.map((r) => toServiceOrRepairRecord(r, 'repair')),
    ...expense.items.map(toExpenseRecord),
    ...odometer.items.map(toOdometerRecord),
  ];
  merged.sort((a, b) => (a.date < b.date ? 1 : -1));
  return merged;
}

export async function fetchVehicleDocuments(vehicleId: string): Promise<VehicleDocument[]> {
  const { items } = await api.getPaginated<RawDocument>(`vehicles/${vehicleId}/documents`, FULL_PAGE);
  return items.map(toDocument);
}

export async function fetchGarageVehicles(garageId: string): Promise<Vehicle[]> {
  const { items } = await api.getPaginated<RawVehicle>('vehicles', { garageId, ...FULL_PAGE });
  return items.map(toVehicle);
}

/** No garage-level records endpoint exists — fetch each vehicle's records and merge. */
export async function fetchGarageRecords(garageId: string): Promise<VehicleRecord[]> {
  const vehicles = await fetchGarageVehicles(garageId);
  const perVehicle = await Promise.all(vehicles.map((v) => fetchVehicleRecords(v.id)));
  const merged = perVehicle.flat();
  merged.sort((a, b) => (a.date < b.date ? 1 : -1));
  return merged;
}

/** No garage-level documents endpoint exists — fetch each vehicle's documents and merge. */
export async function fetchGarageDocuments(garageId: string): Promise<VehicleDocument[]> {
  const vehicles = await fetchGarageVehicles(garageId);
  const perVehicle = await Promise.all(vehicles.map((v) => fetchVehicleDocuments(v.id)));
  const merged = perVehicle.flat();
  merged.sort((a, b) => (a.addedAt < b.addedAt ? 1 : -1));
  return merged;
}

/**
 * There's no GET-by-id endpoint for a project stage, its modifications, or
 * its parts (only PATCH /stages/:id, POST .../modifications, POST
 * .../parts) — but the project-level responses this app already fetches
 * (GET vehicles/:id/projects, GET projects/:id) nest full stage +
 * modification + part rows. So every time a project is fetched, its stages'
 * data is seeded straight into the cache under `qk.buildStage` /
 * `qk.stageModifications` / `qk.stageParts`, and `useBuildStage` /
 * `useStageModifications` / `useStageParts` simply read that cache instead
 * of issuing their own request. This means a build-stage screen only has
 * data if the user reached it after the project was fetched at least once
 * in this session — a real limitation of the API surface, not a client bug,
 * flagged in the integration report.
 */
function seedStageCaches(raw: RawProject) {
  for (const stage of raw.stages) {
    queryClient.setQueryData(qk.buildStage(stage.id), toStage(stage));
    queryClient.setQueryData(qk.stageModifications(stage.id), stage.modifications.map(toModification));
    queryClient.setQueryData(qk.stageParts(stage.id), stage.parts.map(toPart));
  }
}

/**
 * The mock data layer modeled one ProjectBuild per vehicle; the real API
 * supports many (GET vehicles/:id/projects is a paginated list). This picks
 * the most recently created one to preserve the old "one build" UX — a
 * vehicle with more than one project build only surfaces the latest via
 * `useProject`.
 */
export async function fetchVehicleProject(vehicleId: string): Promise<ProjectBuild | null> {
  const { items } = await api.getPaginated<RawProject>(`vehicles/${vehicleId}/projects`, { pageSize: 5 });
  const raw = items[0];
  // React Query forbids a queryFn ever resolving `undefined` (it throws
  // "Query data cannot be undefined") — `null` is the correct "no project
  // for this vehicle" value.
  if (!raw) return null;
  seedStageCaches(raw);
  return toProject(raw);
}

export async function fetchProjectById(projectId: string): Promise<ProjectBuild> {
  const raw = await api.get<RawProject>(`projects/${projectId}`);
  seedStageCaches(raw);
  return toProject(raw);
}

export async function fetchVehicleAccessRequests(vehicleId: string): Promise<AccessRequest[]> {
  const { items } = await api.getPaginated<RawAccessRequest>(`vehicles/${vehicleId}/access-requests`, FULL_PAGE);
  return items.map(toAccessRequest);
}

/** No garage-level access-requests endpoint exists — fetch each vehicle's and merge/filter. */
export async function fetchGaragePendingAccessRequests(garageId: string): Promise<AccessRequest[]> {
  const vehicles = await fetchGarageVehicles(garageId);
  const perVehicle = await Promise.all(vehicles.map((v) => fetchVehicleAccessRequests(v.id)));
  return perVehicle.flat().filter((r) => r.status === 'pending');
}

export { RECORD_TYPES };
