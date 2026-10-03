/**
 * Mutation layer over the real `/api/v1/*` API. Kept as plain async
 * functions (not `useMutation` hooks) so the ~25 screens that already do
 * `await addRecord(...); router.push(...)` keep working with minimal
 * changes — each function calls the API, then invalidates the relevant
 * `@tanstack/react-query` cache entries via the shared `queryClient` before
 * returning, so screens see fresh data on their next render without wiring
 * up `onSuccess`/invalidation themselves.
 *
 * Two signatures changed from the mock version because the real API needs
 * information the mock's flat in-memory arrays didn't: `updateGarageMemberRole`
 * and `removeGarageMember` now take `garageId` first (the real endpoint is
 * `PATCH/DELETE /garages/:garageId/members/:memberId` — there's no
 * standalone `/members/:id`). The one existing call site
 * (`src/app/garages/[id]/members.tsx`) needs updating to pass it.
 */
import { api } from '@/data/api/client';
import { clearProgress } from '@/features/onboarding/progress';
import { fetchVehicleDocuments, fetchVehicleProject, fetchVehicleRecords } from '@/data/api/aggregates';
import {
  toAccount,
  toDocument,
  toExpenseRecord,
  toFuelRecord,
  toGarage,
  toGarageMember,
  toOdometerRecord,
  toReminder,
  toServiceOrRepairRecord,
  toApiEnum,
  toVehicle,
  type RawAccount,
  type RawDocument,
  type RawExpenseRecord,
  type RawFuelRecord,
  type RawGarage,
  type RawGarageMember,
  type RawOdometerReading,
  type RawReminder,
  type RawServiceRepairRecord,
  type RawVehicle,
} from '@/data/api/mappers';
import { queryClient } from '@/data/queryClient';
import { qk } from '@/data/queryKeys';
import { setUiState } from '@/data/uiState';
import type {
  Account,
  AccessRequestStatus,
  BuildStage,
  EstimateStatus,
  Garage,
  GarageMember,
  Modification,
  PartLine,
  Powertrain,
  Transmission,
  ProjectBuild,
  Region,
  Reminder,
  Vehicle,
  VehicleDocument,
  VehicleRecord,
  VehicleType,
  VehicleUsage,
} from '@/types/domain';

// ---------- helpers ----------

/** "2026-08-26" -> "2026-08-26T00:00:00.000Z". The API's zod schemas require a full ISO datetime. */
function toApiDateTime(dateOnly: string): string {
  const hasTime = dateOnly.includes('T');
  return hasTime ? dateOnly : `${dateOnly}T00:00:00.000Z`;
}

function invalidatePrefix(prefix: string) {
  return queryClient.invalidateQueries({ queryKey: [prefix] });
}

// ---------- Onboarding / account ----------

export type OnboardingPayload = {
  name: string;
  email: string;
  region: Region;
  profile: 'owner' | 'mechanic' | 'both';
  garageName: string;
  garageLocation: string;
  vehicle: {
    type: VehicleType;
    usage: VehicleUsage;
    make: string;
    model: string;
    variant?: string;
    year: number;
    odometerKm: number;
    powertrain?: Powertrain;
    transmission?: Transmission;
    vin?: string;
  };
};

/**
 * Finishes owner set-up for the signed-in account (or the development test
 * account): saves the name and country, uses the account's first garage or
 * creates one, and adds the vehicle just described.
 *
 * - `plate` is required server-side but not collected during set-up; a
 *   placeholder is sent until it is set from Vehicle Details.
 * - Only the OWNER profile is switched to here; the mechanic side has its
 *   own set-up (completeWorkshopOnboarding).
 */
export async function completeOnboarding(payload: OnboardingPayload): Promise<Vehicle> {
  const garages = await api.get<RawGarage[]>('garages');
  const name = payload.garageName.trim();
  const location = payload.garageLocation.trim();
  const garage =
    garages[0] ??
    (await api.post<RawGarage>('garages', {
      name: name || (payload.name.trim() ? `${payload.name.trim().split(' ')[0]}'s garage` : 'My garage'),
      location: location || 'Not set',
    }));

  await api.patch<RawAccount>('account', {
    region: payload.region,
    name: payload.name.trim() || undefined,
    activeProfileType: payload.profile === 'mechanic' ? undefined : 'OWNER',
  });

  if (garages[0] && (name || location)) {
    await api.patch<RawGarage>(`garages/${garage.id}`, {
      name: name || undefined,
      location: location || undefined,
    });
  }

  const rawVehicle = await api.post<RawVehicle>('vehicles', {
    garageId: garage.id,
    make: payload.vehicle.make,
    model: payload.vehicle.model,
    year: payload.vehicle.year,
    type: payload.vehicle.type.toUpperCase(),
    usage: payload.vehicle.usage.toUpperCase(),
    // Not collected at onboarding (prototype screen 07 has no plate field) but required server-side — see module doc.
    plate: 'UNASSIGNED',
    odometerKm: payload.vehicle.odometerKm,
    powertrain: toApiEnum(payload.vehicle.powertrain),
    transmission: toApiEnum(payload.vehicle.transmission),
    variant: payload.vehicle.variant?.trim() || undefined,
    vin: payload.vehicle.vin?.trim() || undefined,
  });

  await setUiState({ onboarded: true, activeGarageId: garage.id });
  await clearProgress();

  await Promise.all([
    queryClient.invalidateQueries({ queryKey: qk.account() }),
    queryClient.invalidateQueries({ queryKey: qk.garages() }),
    queryClient.invalidateQueries({ queryKey: qk.garage(garage.id) }),
    queryClient.invalidateQueries({ queryKey: qk.vehicles(garage.id) }),
  ]);

  return toVehicle(rawVehicle);
}

/**
 * Mechanic-only set up: country and business, and set up is done (no
 * vehicle is required). Creates the workshop and points this device at the
 * mechanic side. An owner who also fixes cars runs this after the owner
 * set up, so their garage is kept.
 */
export async function completeWorkshopOnboarding(input: {
  region: Region;
  name: string;
  businessName: string;
  town?: string;
  teamSize?: 'solo' | 'helper' | 'team';
  /** Set when this set-up already created the workshop (the person went Back): update it instead. */
  workshopId?: string;
}): Promise<{ id: string; name: string }> {
  await api.patch<RawAccount>('account', { region: input.region, name: input.name.trim() || undefined });
  const body = { name: input.businessName.trim(), town: input.town?.trim() || undefined, teamSize: input.teamSize?.toUpperCase() };
  const workshop = input.workshopId
    ? await api.patch<{ id: string; name: string }>(`workshops/${input.workshopId}`, body)
    : await api.post<{ id: string; name: string }>('workshops', body);
  const garages = await api.get<RawGarage[]>('garages').catch(() => [] as RawGarage[]);
  await setUiState({ onboarded: true, mode: 'mechanic', activeWorkshopId: workshop.id, activeGarageId: garages[0]?.id ?? null });
  await clearProgress();
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: qk.account() }),
    queryClient.invalidateQueries({ queryKey: ['workshops'] }),
  ]);
  return workshop;
}

/**
 * The mock version wiped the local demo dataset back to a logged-out state.
 * There's no equivalent "wipe the server" action in scope (and it would be
 * destructive against a shared dev account) — this now only resets local UI
 * state (onboarding flag, selected garage) and clears the query cache, so
 * the app behaves as "logged out" again on this device without touching
 * server data.
 */
export async function resetDemoData(): Promise<void> {
  await setUiState({ onboarded: false, activeGarageId: null });
  queryClient.clear();
}

export async function getAccount(): Promise<Account | null> {
  try {
    return await api.get<RawAccount>('account').then(toAccount);
  } catch {
    return null;
  }
}

export async function updateAccount(patch: Partial<Account>): Promise<Account | null> {
  const updated = await api.patch<RawAccount>('account', {
    region: patch.region,
    name: patch.name,
    // See completeOnboarding's doc — switching to MECHANIC has no backing AccountProfile row for the dev account.
    activeProfileType: patch.activeProfile === 'mechanic' ? undefined : patch.activeProfile ? 'OWNER' : undefined,
  });
  await queryClient.invalidateQueries({ queryKey: qk.account() });
  return toAccount(updated);
}

/** Saves the notification settings on the server, which decides what is pushed. Shown at once. */
export async function setNotificationPrefs(prefs: Record<string, boolean>): Promise<void> {
  queryClient.setQueryData<Account>(qk.account(), (a) => (a ? { ...a, notificationPrefs: prefs } : a));
  try {
    await api.patch('account', { notificationPrefs: prefs });
  } finally {
    await queryClient.invalidateQueries({ queryKey: qk.account() });
  }
}

export async function setActiveGarage(garageId: string): Promise<void> {
  await setUiState({ activeGarageId: garageId });
}

// ---------- Garages ----------

export async function getGarages(): Promise<Garage[]> {
  return api.get<RawGarage[]>('garages').then((rows) => rows.map(toGarage));
}

export async function getGarage(garageId: string): Promise<Garage | undefined> {
  return api.get<RawGarage>(`garages/${garageId}`).then(toGarage);
}

export async function addGarage(input: { name: string; location: string }): Promise<Garage> {
  const raw = await api.post<RawGarage>('garages', input);
  await setUiState({ activeGarageId: raw.id });
  await queryClient.invalidateQueries({ queryKey: qk.garages() });
  return toGarage(raw);
}

export async function updateGarage(garageId: string, patch: Partial<Garage>): Promise<Garage | undefined> {
  const raw = await api.patch<RawGarage>(`garages/${garageId}`, { name: patch.name, location: patch.location });
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: qk.garage(garageId) }),
    queryClient.invalidateQueries({ queryKey: qk.garages() }),
  ]);
  return toGarage(raw);
}

/** Garage has no soft-delete — this is permanent and cascades to every vehicle/record/document under it (see admin/prisma/schema.prisma). */
export async function deleteGarage(garageId: string): Promise<void> {
  await api.delete(`garages/${garageId}`);
  await setUiState({ activeGarageId: null });
  await queryClient.invalidateQueries({ queryKey: qk.garages() });
}

export async function getGarageMembers(garageId: string): Promise<GarageMember[]> {
  return api.get<RawGarageMember[]>(`garages/${garageId}/members`).then((rows) => rows.map(toGarageMember));
}

export async function updateGarageMemberRole(garageId: string, memberId: string, role: GarageMember['role']): Promise<void> {
  if (role === 'pending') return; // not a real server-side role — see mappers.ts doc
  await api.patch(`garages/${garageId}/members/${memberId}`, { role: role.toUpperCase() });
  await queryClient.invalidateQueries({ queryKey: qk.garageMembers(garageId) });
}

export async function removeGarageMember(garageId: string, memberId: string): Promise<void> {
  await api.delete(`garages/${garageId}/members/${memberId}`);
  await queryClient.invalidateQueries({ queryKey: qk.garageMembers(garageId) });
}

/**
 * The real endpoint (`POST /garages/:id/invitations`) only stores an email —
 * there's no GET to list pending invitations back afterward (POST-only
 * resource), and no "name" field on GarageInvitation. To keep the UI
 * feedback the mock gave (an invite immediately shows as a 'pending' row),
 * this optimistically seeds one into the `garageMembers` cache using the
 * name the inviter typed. It won't survive a real refetch (there's nowhere
 * to re-fetch it from) — a real "pending invites" list needs a GET
 * counterpart on the admin side.
 */
export async function inviteGarageMember(garageId: string, input: { name: string; email: string }): Promise<GarageMember> {
  await api.post(`garages/${garageId}/invitations`, { email: input.email });
  const pending: GarageMember = { id: `invite-${input.email}`, garageId, name: input.name, role: 'pending', email: input.email };
  queryClient.setQueryData<GarageMember[]>(qk.garageMembers(garageId), (current) => [...(current ?? []), pending]);
  return pending;
}

// ---------- Vehicles ----------

export async function getVehicles(garageId: string): Promise<Vehicle[]> {
  const { items } = await api.getPaginated<RawVehicle>('vehicles', { garageId, pageSize: 100 });
  return items.map(toVehicle);
}

export async function getVehicle(vehicleId: string): Promise<Vehicle | undefined> {
  return api.get<RawVehicle>(`vehicles/${vehicleId}`).then(toVehicle);
}

export async function addVehicle(input: Omit<Vehicle, 'id'>): Promise<Vehicle> {
  const raw = await api.post<RawVehicle>('vehicles', {
    garageId: input.garageId,
    make: input.make,
    model: input.model,
    year: input.year,
    type: input.type.toUpperCase(),
    usage: input.usage.toUpperCase(),
    plate: input.plate?.trim() || 'UNASSIGNED',
    odometerKm: input.odometerKm,
    photo: input.photo,
    vin: input.vin,
    powertrain: toApiEnum(input.powertrain),
    nextServiceDueKm: input.nextServiceDueKm,
    color: input.color,
  });
  await queryClient.invalidateQueries({ queryKey: qk.vehicles(input.garageId) });
  return toVehicle(raw);
}

export async function updateVehicle(vehicleId: string, patch: Partial<Vehicle>): Promise<Vehicle | undefined> {
  const raw = await api.patch<RawVehicle>(`vehicles/${vehicleId}`, {
    make: patch.make,
    model: patch.model,
    year: patch.year,
    type: patch.type?.toUpperCase(),
    usage: patch.usage?.toUpperCase(),
    plate: patch.plate,
    odometerKm: patch.odometerKm,
    photo: patch.photo,
    vin: patch.vin,
    powertrain: toApiEnum(patch.powertrain),
    nextServiceDueKm: patch.nextServiceDueKm,
    color: patch.color,
  });
  await Promise.all([queryClient.invalidateQueries({ queryKey: qk.vehicle(vehicleId) }), invalidatePrefix('vehicles')]);
  return toVehicle(raw);
}

// ---------- Records ----------

export async function getRecords(vehicleId: string): Promise<VehicleRecord[]> {
  return fetchVehicleRecords(vehicleId);
}

/** No `GET /records/:id` endpoint — see `useRecord` in `@/data/hooks` for the same cache-lookup approach. */
export async function getRecord(recordId: string): Promise<VehicleRecord | undefined> {
  for (const prefix of ['records', 'garageRecords']) {
    const entries = queryClient.getQueriesData<VehicleRecord[]>({ queryKey: [prefix] });
    for (const [, data] of entries) {
      const found = data?.find((r) => r.id === recordId);
      if (found) return found;
    }
  }
  return undefined;
}

function recordBody(vehicleId: string, input: Omit<VehicleRecord, 'id' | 'vehicleId'>) {
  const base = { date: toApiDateTime(input.date), enteredByName: input.enteredByMemberName, notes: input.notes };
  switch (input.type) {
    case 'odometer':
      return { ...base, type: 'odometer', odometerKm: input.odometerAtEntry };
    case 'fuel':
      return { ...base, type: 'fuel', amount: input.amount, odometerAtEntry: input.odometerAtEntry, litres: input.litres, place: input.place };
    case 'expense':
      return {
        ...base,
        type: 'expense',
        amount: input.amount,
        odometerAtEntry: input.odometerAtEntry,
        category: (input.category ?? 'other').toUpperCase(),
        place: input.place,
      };
    case 'service':
    case 'repair':
      return { ...base, type: input.type, amount: input.amount, odometerAtEntry: input.odometerAtEntry, place: input.place };
    default:
      // 'part' isn't one of the five API record tables (parts are modeled separately — see Part in schema.prisma).
      return { ...base, type: 'expense', amount: input.amount, odometerAtEntry: input.odometerAtEntry, category: 'OTHER', place: input.place };
  }
}

/**
 * Also bumps `Vehicle.odometerKm` when this record's odometer reading is
 * higher than what's on file — the mock store did this automatically;
 * the real API does not (creating a record never touches the vehicle row),
 * so it's replicated here as a follow-up PATCH to keep vehicle cards/
 * insights showing an up-to-date reading.
 */
export async function addRecord(vehicleId: string, input: Omit<VehicleRecord, 'id' | 'vehicleId'>): Promise<VehicleRecord> {
  const created = await api.post<RawFuelRecord | RawServiceRepairRecord | RawExpenseRecord | RawOdometerReading>(
    `vehicles/${vehicleId}/records`,
    recordBody(vehicleId, input)
  );

  const vehicle = await api.get<RawVehicle>(`vehicles/${vehicleId}`);
  if (input.odometerAtEntry > vehicle.odometerKm) {
    await api.patch(`vehicles/${vehicleId}`, { odometerKm: input.odometerAtEntry });
  }

  await Promise.all([
    queryClient.invalidateQueries({ queryKey: qk.records(vehicleId) }),
    queryClient.invalidateQueries({ queryKey: qk.vehicle(vehicleId) }),
    queryClient.invalidateQueries({ queryKey: qk.timeline(vehicleId) }),
    queryClient.invalidateQueries({ queryKey: qk.insights(vehicleId) }),
    invalidatePrefix('garageRecords'),
    invalidatePrefix('vehicles'),
  ]);

  switch (input.type) {
    case 'fuel':
      return toFuelRecord(created as RawFuelRecord);
    case 'service':
      return toServiceOrRepairRecord(created as RawServiceRepairRecord, 'service');
    case 'repair':
      return toServiceOrRepairRecord(created as RawServiceRepairRecord, 'repair');
    case 'odometer':
      return toOdometerRecord(created as RawOdometerReading);
    default:
      return toExpenseRecord(created as RawExpenseRecord);
  }
}

export async function updateRecord(recordId: string, patch: Partial<VehicleRecord>): Promise<VehicleRecord | undefined> {
  await api.patch(`records/${recordId}`, {
    date: patch.date ? toApiDateTime(patch.date) : undefined,
    amount: patch.amount,
    odometerAtEntry: patch.odometerAtEntry,
    litres: patch.litres,
    category: patch.category?.toUpperCase(),
    place: patch.place,
    notes: patch.notes,
  });
  await Promise.all([invalidatePrefix('records'), invalidatePrefix('garageRecords'), invalidatePrefix('timeline'), invalidatePrefix('insights')]);
  return getRecord(recordId);
}

export async function deleteRecord(recordId: string): Promise<void> {
  await api.delete(`records/${recordId}`);
  await Promise.all([invalidatePrefix('records'), invalidatePrefix('garageRecords'), invalidatePrefix('timeline'), invalidatePrefix('insights')]);
}

// ---------- Documents ----------

export async function getDocuments(vehicleId: string): Promise<VehicleDocument[]> {
  return fetchVehicleDocuments(vehicleId);
}

export async function addDocument(vehicleId: string, input: Omit<VehicleDocument, 'id' | 'vehicleId'>): Promise<VehicleDocument> {
  const raw = await api.post<RawDocument>(`vehicles/${vehicleId}/documents`, {
    documentTypeCode: input.type,
    title: input.title,
    expiryDate: input.expiryDate ? toApiDateTime(input.expiryDate) : undefined,
    fileKey: input.fileRef,
  });
  await Promise.all([queryClient.invalidateQueries({ queryKey: qk.documents(vehicleId) }), invalidatePrefix('garageDocuments')]);
  return toDocument(raw);
}

export async function updateDocument(documentId: string, patch: Partial<VehicleDocument>): Promise<VehicleDocument | undefined> {
  const raw = await api.patch<RawDocument>(`documents/${documentId}`, {
    title: patch.title,
    expiryDate: patch.expiryDate ? toApiDateTime(patch.expiryDate) : undefined,
    fileKey: patch.fileRef,
  });
  await Promise.all([invalidatePrefix('documents'), invalidatePrefix('garageDocuments')]);
  return toDocument(raw);
}

export async function deleteDocument(documentId: string): Promise<void> {
  await api.delete(`documents/${documentId}`);
  await Promise.all([invalidatePrefix('documents'), invalidatePrefix('garageDocuments')]);
}

// ---------- Reminders ----------

export async function getReminders(vehicleId: string): Promise<Reminder[]> {
  const { items } = await api.getPaginated<RawReminder>(`vehicles/${vehicleId}/reminders`, { pageSize: 100 });
  return items.map(toReminder);
}

export async function resolveReminder(reminderId: string): Promise<void> {
  await api.post(`reminders/${reminderId}/resolve`);
  await Promise.all([invalidatePrefix('reminders'), invalidatePrefix('garageReminders')]);
}

/**
 * There is no `POST /vehicles/:id/reminders` — reminders are only ever
 * created server-side (there's no route for it in admin's /api/v1 surface
 * at all; presumably a future background job). No screen currently calls
 * this (verified: `addReminder(` has zero call sites), so it's left
 * unimplemented with a clear error rather than silently no-oping.
 */
export async function addReminder(_vehicleId: string, _input: Omit<Reminder, 'id' | 'vehicleId'>): Promise<Reminder> {
  throw new Error('Creating reminders directly is not supported by the API yet (no POST /vehicles/:id/reminders route).');
}

// ---------- Project build ----------

/** No call sites use this directly (screens use the `useProject` hook) — kept for signature parity, delegates to the same fetcher the hook uses. */
export async function getProject(vehicleId: string): Promise<ProjectBuild | null> {
  return fetchVehicleProject(vehicleId);
}

export async function addBuildStage(projectId: string, name: string, estimate?: number): Promise<void> {
  await api.post(`projects/${projectId}/stages`, { name });
  // `estimate` (planned spend) has no column on ProjectStage server-side — see mappers.ts doc. Accepted for signature parity, not persisted.
  void estimate;
  await queryClient.invalidateQueries({ queryKey: qk.project(projectId) });
  await invalidatePrefix('projects');
}

export async function updateProjectBrief(
  projectId: string,
  patch: Partial<Pick<ProjectBuild, 'briefType' | 'budget' | 'contingencyPct'>>
): Promise<void> {
  // briefType/contingencyPct have no columns on Project server-side — see mappers.ts doc. Only budget persists.
  if (patch.budget != null) {
    await api.patch(`projects/${projectId}`, { budget: patch.budget });
  }
  await queryClient.invalidateQueries({ queryKey: qk.project(projectId) });
  await invalidatePrefix('projects');
}

export async function updateStageStatus(stageId: string, status: BuildStage['status']): Promise<void> {
  const STATUS_MAP: Record<BuildStage['status'], string> = { 'not-started': 'NOT_STARTED', 'in-progress': 'IN_PROGRESS', done: 'DONE' };
  await api.patch(`stages/${stageId}`, { status: STATUS_MAP[status] });
  queryClient.setQueryData<BuildStage | undefined>(qk.buildStage(stageId), (current) => (current ? { ...current, status } : current));
  await invalidatePrefix('projects');
}

export async function addModification(
  stageId: string,
  input: { name: string; cost: number; area?: Modification['area']; date?: string }
): Promise<void> {
  // area/date have no columns on Modification server-side — see mappers.ts doc. Only name/cost persist.
  await api.post(`stages/${stageId}/modifications`, { name: input.name, cost: input.cost });
  await queryClient.invalidateQueries({ queryKey: qk.stageModifications(stageId) });
  await invalidatePrefix('projects');
}

export async function addPart(
  stageId: string,
  input: { name: string; cost: number; supplier?: string; brand?: string; partNumber?: string; quantity?: number; status?: PartLine['status']; date?: string }
): Promise<void> {
  // brand/partNumber/quantity/status have no columns on Part server-side — see mappers.ts doc. Only name/cost/supplier/date persist.
  await api.post(`stages/${stageId}/parts`, { name: input.name, cost: input.cost, supplier: input.supplier, date: input.date ? toApiDateTime(input.date) : undefined });
  await queryClient.invalidateQueries({ queryKey: qk.stageParts(stageId) });
  await invalidatePrefix('projects');
}

// ---------- Estimates / invoices / inspections / access ----------

export async function respondToEstimate(estimateId: string, status: EstimateStatus): Promise<void> {
  if (status === 'pending') return;
  await api.post(`estimates/${estimateId}/decision`, { decision: status === 'approved' ? 'APPROVED' : 'DECLINED' });
  await Promise.all([queryClient.invalidateQueries({ queryKey: qk.estimate(estimateId) }), invalidatePrefix('estimates')]);
}

/**
 * There's no invoice-payment endpoint in the real API (no
 * `POST /invoices/:id/pay` or similar — `Payment` exists in the schema but
 * nothing under `/api/v1` creates one from the owner side). Left throwing
 * rather than faked, so the "Pay" screen shows a real error instead of a
 * false success.
 */
export async function payInvoice(_invoiceId: string): Promise<void> {
  throw new Error('Paying an invoice from the app is not supported by the API yet (no payment endpoint under /api/v1/invoices).');
}

export async function respondToAccessRequest(requestId: string, status: AccessRequestStatus): Promise<void> {
  if (status === 'pending') return;
  await api.post(`access-requests/${requestId}/${status === 'approved' ? 'approve' : 'deny'}`);
  await invalidatePrefix('accessRequests');
  await invalidatePrefix('pendingAccessRequests');
}

// ---------- Sell / transfer ----------

/**
 * There's no "transfer to a new owner" concept in the schema — the closest
 * real action is a hard delete (Vehicle has no soft-delete; DELETE cascades
 * to every record/document/reminder under it, see admin/prisma/schema.prisma).
 * This is destructive and permanent, unlike the mock version's simple
 * "remove from my list".
 */
export async function transferVehicle(vehicleId: string): Promise<void> {
  await api.delete(`vehicles/${vehicleId}`);
  await invalidatePrefix('vehicles');
}
