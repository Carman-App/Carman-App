/**
 * Maps raw JSON shapes returned by admin/'s `/api/v1/*` (Prisma models,
 * serialized) onto the mobile-side domain types in `@/types/domain`.
 *
 * Kept in one place because several of these mappings paper over real
 * schema differences between the mock data layer's assumed shape and the
 * actual Prisma schema (see AGENTS.md's "Constraints" section — the API is
 * the source of truth, so mobile's types/mapping adapt, not the schema).
 * Notable ones, all called out again in the integration report:
 *
 * - Vehicle.variant does not exist in the Prisma schema at all. It's kept
 *   optional on the mobile `Vehicle` type for UI reuse, but a value entered
 *   in onboarding is NEVER persisted server-side and always reads back
 *   `undefined` — there's nowhere to send it.
 * - Vehicle.plate is REQUIRED server-side (mock made it optional, uncollected
 *   at onboarding). Onboarding now sends a placeholder ("UNASSIGNED") when
 *   the user hasn't set a plate yet.
 * - GarageMember has no 'pending' role server-side (only OWNER/MEMBER) —
 *   pending invites are a separate GarageInvitation resource. Mapped members
 *   are always 'owner' | 'member'; pending invites are surfaced separately.
 * - Account.plan and Account.profile ('owner'|'mechanic'|'both') don't exist
 *   as single fields server-side — Account has a `region` and a list of
 *   AccountProfile rows instead. `plan` has no server-side source at all
 *   yet (no Subscription lookup on this route) and is hardcoded to 'free'.
 * - ProjectStage/Modification/Part are missing several fields the mock
 *   modeled (stage.estimate; modification.area/date; part.brand/partNumber/
 *   quantity/status) — these always map to `undefined` and don't round-trip.
 * - All server dates are full ISO datetimes; the mock (and every screen's
 *   date formatting helper in `@/lib/format`) assumes a plain `YYYY-MM-DD`
 *   date string. Every date field is normalized to date-only here on the
 *   way in, and expanded back to a full ISO datetime on the way out (see
 *   `toApiDateTime` in `@/data/repo`).
 * - Prisma `Decimal` fields (money amounts) serialize as JSON strings, not
 *   numbers — every money field is run through `Number(...)` here.
 */
import type {
  Account,
  AccessRequest,
  AccessRequestStatus,
  BuildStage,
  Estimate,
  EstimateStatus,
  Garage,
  GarageMember,
  InspectionReport,
  Invoice,
  Modification,
  PartLine,
  Powertrain,
  ProjectBuild,
  Region,
  Reminder,
  ReminderKind,
  DocumentType,
  RecordType,
  Vehicle,
  VehicleDocument,
  VehicleRecord,
  VehicleType,
  VehicleUsage,
} from '@/types/domain';

// ---------- primitive helpers ----------

/** "2026-08-26T05:20:00.503Z" -> "2026-08-26". Safe on already-date-only strings. */
export function toDateOnly(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  return value.slice(0, 10);
}

/** Prisma Decimal fields arrive as JSON strings (or occasionally numbers). */
export function toAmount(value: unknown): number {
  if (value == null) return 0;
  if (typeof value === 'number') return value;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function toNullableAmount(value: unknown): number | undefined {
  if (value == null) return undefined;
  return toAmount(value);
}

// ---------- Account ----------

export type RawUser = { id: string; email: string; name: string };
export type RawAccountProfile = { id: string; type: 'OWNER' | 'MECHANIC'; isActive: boolean };
export type RawAccount = {
  id: string;
  userId: string;
  region: Region;
  user: RawUser;
  profiles: RawAccountProfile[];
};

export function toAccount(raw: RawAccount): Account {
  const types = new Set(raw.profiles.map((p) => p.type));
  const profile: Account['profile'] =
    types.has('OWNER') && types.has('MECHANIC') ? 'both' : types.has('MECHANIC') ? 'mechanic' : 'owner';
  const active = raw.profiles.find((p) => p.isActive);
  const activeProfile: Account['activeProfile'] = active?.type === 'MECHANIC' ? 'mechanic' : 'owner';

  return {
    id: raw.id,
    name: raw.user.name,
    email: raw.user.email,
    region: raw.region,
    profile,
    activeProfile,
    // No server-side source yet (no Subscription lookup on GET /account) — see module doc.
    plan: 'free',
  };
}

// ---------- Garage ----------

export type RawGarage = { id: string; ownerId: string; name: string; location: string };

/** memberIds is always [] — the garage list/detail endpoints don't include members; fetch them via useGarageMembers instead. */
export function toGarage(raw: RawGarage): Garage {
  return { id: raw.id, name: raw.name, location: raw.location, ownerId: raw.ownerId, memberIds: [] };
}

export type RawGarageMember = {
  id: string;
  garageId: string;
  accountId: string;
  role: 'OWNER' | 'MEMBER';
  displayName: string;
  joinedAt: string;
};

export function toGarageMember(raw: RawGarageMember): GarageMember {
  return {
    id: raw.id,
    garageId: raw.garageId,
    name: raw.displayName,
    role: raw.role === 'OWNER' ? 'owner' : 'member',
    joinedAt: toDateOnly(raw.joinedAt),
  };
}

export type RawGarageInvitation = {
  id: string;
  garageId: string;
  email: string;
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED';
};

/** Pending invitations surfaced as a 'pending' GarageMember for screens that render one merged member list. */
export function invitationToPendingMember(raw: RawGarageInvitation): GarageMember {
  return { id: raw.id, garageId: raw.garageId, name: raw.email, role: 'pending', email: raw.email };
}

// ---------- Vehicle ----------

const VEHICLE_TYPE: Record<string, VehicleType> = { CAR: 'car', MOTORCYCLE: 'motorcycle' };
const VEHICLE_USAGE: Record<string, VehicleUsage> = {
  DAILY: 'daily',
  PROJECT: 'project',
  WEEKEND: 'weekend',
  COMMERCIAL: 'commercial',
};
const POWERTRAIN: Record<string, Powertrain> = {
  PETROL: 'petrol',
  DIESEL: 'diesel',
  HYBRID: 'hybrid',
  ELECTRIC: 'electric',
};

export type RawVehicle = {
  id: string;
  garageId: string;
  make: string;
  model: string;
  year: number;
  type: string;
  usage: string;
  plate: string;
  odometerKm: number;
  photo: string | null;
  vin: string | null;
  powertrain: string | null;
  nextServiceDueKm: number | null;
  color: string | null;
  createdAt: string;
};

export function toVehicle(raw: RawVehicle): Vehicle {
  return {
    id: raw.id,
    garageId: raw.garageId,
    make: raw.make,
    model: raw.model,
    // Not a real column server-side — see module doc. Never round-trips.
    variant: undefined,
    year: raw.year,
    type: VEHICLE_TYPE[raw.type] ?? 'car',
    usage: VEHICLE_USAGE[raw.usage] ?? 'daily',
    plate: raw.plate,
    odometerKm: raw.odometerKm,
    photo: raw.photo ?? undefined,
    vin: raw.vin ?? undefined,
    powertrain: raw.powertrain ? POWERTRAIN[raw.powertrain] : undefined,
    nextServiceDueKm: raw.nextServiceDueKm ?? undefined,
    color: raw.color ?? undefined,
    createdAt: toDateOnly(raw.createdAt) ?? raw.createdAt,
  };
}

// ---------- Records ----------

export type RawFuelRecord = {
  id: string;
  vehicleId: string;
  date: string;
  amount: unknown;
  litres: unknown;
  odometerAtEntry: number;
  place: string | null;
  enteredByName: string;
  notes: string | null;
};
export type RawServiceRepairRecord = {
  id: string;
  vehicleId: string;
  date: string;
  amount: unknown;
  odometerAtEntry: number;
  description: string | null;
  place: string | null;
  enteredByName: string;
  notes: string | null;
};
export type RawExpenseRecord = {
  id: string;
  vehicleId: string;
  date: string;
  amount: unknown;
  odometerAtEntry: number;
  category: string;
  place: string | null;
  enteredByName: string;
  notes: string | null;
};
export type RawOdometerReading = {
  id: string;
  vehicleId: string;
  date: string;
  odometerKm: number;
  enteredByName: string;
  notes: string | null;
};

const EXPENSE_CATEGORY: Record<string, NonNullable<VehicleRecord['category']>> = {
  FUEL: 'fuel',
  SERVICE: 'service',
  INSURANCE: 'insurance',
  LOAN: 'loan',
  OTHER: 'other',
};

export function toFuelRecord(raw: RawFuelRecord): VehicleRecord {
  return {
    id: raw.id,
    vehicleId: raw.vehicleId,
    type: 'fuel',
    date: toDateOnly(raw.date) ?? raw.date,
    amount: toAmount(raw.amount),
    odometerAtEntry: raw.odometerAtEntry,
    place: raw.place ?? undefined,
    enteredByMemberName: raw.enteredByName,
    notes: raw.notes ?? undefined,
    litres: toNullableAmount(raw.litres),
    category: 'fuel',
  };
}

export function toServiceOrRepairRecord(raw: RawServiceRepairRecord, type: 'service' | 'repair'): VehicleRecord {
  return {
    id: raw.id,
    vehicleId: raw.vehicleId,
    type,
    date: toDateOnly(raw.date) ?? raw.date,
    amount: toAmount(raw.amount),
    odometerAtEntry: raw.odometerAtEntry,
    place: raw.place ?? undefined,
    enteredByMemberName: raw.enteredByName,
    notes: raw.description ? `${raw.description}${raw.notes ? `\n${raw.notes}` : ''}` : raw.notes ?? undefined,
    category: 'service',
  };
}

export function toExpenseRecord(raw: RawExpenseRecord): VehicleRecord {
  return {
    id: raw.id,
    vehicleId: raw.vehicleId,
    type: 'expense',
    date: toDateOnly(raw.date) ?? raw.date,
    amount: toAmount(raw.amount),
    odometerAtEntry: raw.odometerAtEntry,
    place: raw.place ?? undefined,
    enteredByMemberName: raw.enteredByName,
    notes: raw.notes ?? undefined,
    category: EXPENSE_CATEGORY[raw.category] ?? 'other',
  };
}

export function toOdometerRecord(raw: RawOdometerReading): VehicleRecord {
  return {
    id: raw.id,
    vehicleId: raw.vehicleId,
    type: 'odometer',
    date: toDateOnly(raw.date) ?? raw.date,
    amount: 0,
    odometerAtEntry: raw.odometerKm,
    enteredByMemberName: raw.enteredByName,
    notes: raw.notes ?? undefined,
  };
}

export const RECORD_TYPES: RecordType[] = ['fuel', 'service', 'repair', 'expense', 'odometer'];

// ---------- Documents ----------

export type RawDocument = {
  id: string;
  vehicleId: string;
  title: string;
  expiryDate: string | null;
  fileKey: string | null;
  addedAt: string;
  documentType: { code: string; label: string };
};

const DOCUMENT_TYPE_CODES = new Set<DocumentType>(['insurance', 'logbook', 'inspection', 'invoice', 'receipt']);

export function toDocument(raw: RawDocument): VehicleDocument {
  const code = raw.documentType.code.toLowerCase();
  return {
    id: raw.id,
    vehicleId: raw.vehicleId,
    type: DOCUMENT_TYPE_CODES.has(code as DocumentType) ? (code as DocumentType) : 'receipt',
    title: raw.title,
    expiryDate: toDateOnly(raw.expiryDate ?? undefined),
    fileRef: raw.fileKey ?? undefined,
    addedAt: toDateOnly(raw.addedAt) ?? raw.addedAt,
  };
}

// ---------- Reminders ----------

const REMINDER_KIND: Record<string, ReminderKind> = {
  SERVICE_DUE: 'service-due',
  DOCUMENT_EXPIRY: 'document-expiry',
  ESTIMATE_PENDING: 'estimate-pending',
  PROJECT_STALLED: 'project-stalled',
};

export type RawReminder = {
  id: string;
  vehicleId: string;
  kind: string;
  dueDate: string | null;
  dueKm: number | null;
  description: string;
  resolved: boolean;
};

export function toReminder(raw: RawReminder): Reminder {
  return {
    id: raw.id,
    vehicleId: raw.vehicleId,
    kind: REMINDER_KIND[raw.kind] ?? 'service-due',
    dueDate: toDateOnly(raw.dueDate ?? undefined),
    dueKm: raw.dueKm ?? undefined,
    description: raw.description,
    resolved: raw.resolved,
  };
}

// ---------- Project builds ----------

export type RawModification = { id: string; stageId: string; name: string; cost: unknown };
export type RawPart = { id: string; stageId: string | null; name: string; cost: unknown; supplier: string | null; date: string | null };
export type RawStage = {
  id: string;
  projectId: string;
  name: string;
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'DONE';
  modifications: RawModification[];
  parts: RawPart[];
};
export type RawProject = {
  id: string;
  vehicleId: string;
  name: string | null;
  budget: unknown;
  spent: unknown;
  stages: RawStage[];
};

const STAGE_STATUS: Record<RawStage['status'], BuildStage['status']> = {
  NOT_STARTED: 'not-started',
  IN_PROGRESS: 'in-progress',
  DONE: 'done',
};

export function toModification(raw: RawModification): Modification {
  return { id: raw.id, stageId: raw.stageId, name: raw.name, cost: toAmount(raw.cost) };
}

export function toPart(raw: RawPart): PartLine {
  return {
    id: raw.id,
    stageId: raw.stageId ?? '',
    name: raw.name,
    cost: toAmount(raw.cost),
    supplier: raw.supplier ?? undefined,
    date: toDateOnly(raw.date ?? undefined),
  };
}

export function toStage(raw: RawStage): BuildStage {
  return {
    id: raw.id,
    projectId: raw.projectId,
    name: raw.name,
    status: STAGE_STATUS[raw.status] ?? 'not-started',
    modificationIds: raw.modifications.map((m) => m.id),
    partIds: raw.parts.map((p) => p.id),
  };
}

export function toProject(raw: RawProject): ProjectBuild {
  return {
    id: raw.id,
    vehicleId: raw.vehicleId,
    budget: toAmount(raw.budget),
    spent: toAmount(raw.spent),
    stages: raw.stages.map(toStage),
  };
}

// ---------- Estimates / invoices / inspections ----------

const ESTIMATE_STATUS: Record<string, EstimateStatus> = { PENDING: 'pending', APPROVED: 'approved', DECLINED: 'declined' };

export type RawEstimateItem = { id: string; description: string; cost: unknown };
export type RawEstimate = {
  id: string;
  vehicleId: string;
  status: string;
  total: unknown;
  notes: string | null;
  createdAt: string;
  items: RawEstimateItem[];
  workshop: { id: string; name: string };
};

export function toEstimate(raw: RawEstimate): Estimate {
  return {
    id: raw.id,
    vehicleId: raw.vehicleId,
    workshopName: raw.workshop.name,
    status: ESTIMATE_STATUS[raw.status] ?? 'pending',
    lines: raw.items.map((i) => ({ id: i.id, description: i.description, cost: toAmount(i.cost) })),
    total: toAmount(raw.total),
    createdAt: toDateOnly(raw.createdAt) ?? raw.createdAt,
    notes: raw.notes ?? undefined,
  };
}

export type RawInvoiceItem = { id: string; description: string; cost: unknown };
export type RawInvoice = {
  id: string;
  vehicleId: string;
  status: string;
  total: unknown;
  dueDate: string | null;
  createdAt: string;
  items: RawInvoiceItem[];
  workshop: { id: string; name: string };
};

export function toInvoice(raw: RawInvoice): Invoice {
  return {
    id: raw.id,
    vehicleId: raw.vehicleId,
    workshopName: raw.workshop.name,
    status: raw.status === 'PAID' ? 'paid' : 'unpaid',
    lines: raw.items.map((i) => ({ id: i.id, description: i.description, cost: toAmount(i.cost) })),
    total: toAmount(raw.total),
    dueDate: toDateOnly(raw.dueDate ?? undefined),
    createdAt: toDateOnly(raw.createdAt) ?? raw.createdAt,
  };
}

const INSPECTION_ITEM_STATUS: Record<string, 'good' | 'attention' | 'urgent'> = {
  GOOD: 'good',
  ATTENTION: 'attention',
  URGENT: 'urgent',
};

export type RawInspectionItem = { id: string; label: string; status: string; note: string | null };
export type RawInspection = {
  id: string;
  vehicleId: string;
  summary: string;
  createdAt: string;
  items: RawInspectionItem[];
  workshop: { id: string; name: string };
};

export function toInspection(raw: RawInspection): InspectionReport {
  return {
    id: raw.id,
    vehicleId: raw.vehicleId,
    workshopName: raw.workshop.name,
    createdAt: toDateOnly(raw.createdAt) ?? raw.createdAt,
    summary: raw.summary,
    items: raw.items.map((i) => ({
      id: i.id,
      label: i.label,
      status: INSPECTION_ITEM_STATUS[i.status] ?? 'good',
      note: i.note ?? undefined,
    })),
  };
}

const ACCESS_REQUEST_STATUS: Record<string, AccessRequestStatus> = {
  PENDING: 'pending',
  APPROVED: 'approved',
  DENIED: 'denied',
};

export type RawAccessRequest = {
  id: string;
  vehicleId: string;
  status: string;
  scope: string;
  requestedAt: string;
  workshop: { id: string; name: string };
};

export function toAccessRequest(raw: RawAccessRequest): AccessRequest {
  return {
    id: raw.id,
    vehicleId: raw.vehicleId,
    workshopName: raw.workshop.name,
    status: ACCESS_REQUEST_STATUS[raw.status] ?? 'pending',
    requestedAt: toDateOnly(raw.requestedAt) ?? raw.requestedAt,
    scope: raw.scope,
  };
}
