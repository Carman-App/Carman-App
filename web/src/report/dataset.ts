import type { RawConventions, RawGarageReportData, RawRecordType } from '../api/types.ts'
import type { Conventions } from './fmt.ts'
import { toMinor } from './money.ts'

/**
 * The owner-side dataset the expense report is built from: the garage
 * snapshot from GET /garages/:id/report-data, normalised once — money in
 * minor units, event dates as "YYYY-MM-DD", placeholder plates removed.
 */

export type RecordType = RawRecordType

export type CategoryKey = 'fuel' | 'service' | 'repairs' | 'insurance' | 'other'

/** The five categories the brief names (OWN-02), in reading order. */
export const CATEGORY_ORDER: CategoryKey[] = ['fuel', 'service', 'repairs', 'insurance', 'other']

export const CATEGORY_LABEL: Record<CategoryKey, string> = {
  fuel: 'Fuel',
  service: 'Service',
  repairs: 'Repairs and parts',
  insurance: 'Insurance and licences',
  other: 'Everything else',
}

/** Column headings where space is tight. */
export const CATEGORY_SHORT: Record<CategoryKey, string> = {
  fuel: 'Fuel',
  service: 'Service',
  repairs: 'Repairs',
  insurance: 'Insurance',
  other: 'Other',
}

export type Member = {
  id: string
  accountId: string
  name: string
  role: 'owner' | 'member'
  joinedAt: string | null
  removedAt: string | null
}

export type Vehicle = {
  id: string
  make: string
  model: string
  year: number
  type: 'car' | 'motorcycle'
  usage: string
  plate: string | null
  odometerKm: number
  powertrain: string | null
  nextServiceDueKm: number | null
  createdAt: string | null
}

export type Rec = {
  id: string
  vehicleId: string
  type: RecordType
  /** Event date, "YYYY-MM-DD". */
  date: string
  /** Minor units; 0 for odometer readings. */
  amount: number
  litres: number | null
  /** Odometer at the time of the record; null when not captured. */
  odometerKm: number | null
  /** Spending category (null for odometer readings). */
  category: CategoryKey | null
  /** Raw expense category (FUEL/SERVICE/INSURANCE/LOAN/OTHER) for expense records. */
  expenseCategory: string | null
  description: string | null
  place: string | null
  notes: string | null
  enteredByAccountId: string | null
  /** The name the record was entered under — kept as-is (SHARE-07). */
  enteredByName: string
  /** Entry timestamp (ISO). */
  createdAt: string | null
  /** Last edit timestamp (ISO), when edited after entry. */
  editedAt: string | null
}

export type DeletedRec = { id: string; vehicleId: string; type: RecordType; date: string; amount: number; deletedAt: string | null }

export type Reminder = { id: string; vehicleId: string; kind: string; dueDate: string | null; dueKm: number | null; description: string }

export type VehicleDocument = {
  id: string
  vehicleId: string
  typeCode: string
  typeLabel: string
  title: string
  expiryDate: string | null
}

export type Stage = {
  id: string
  name: string
  status: 'not-started' | 'in-progress' | 'done'
  modifications: { id: string; name: string; cost: number }[]
  parts: { id: string; name: string; cost: number; supplier: string | null; date: string | null }[]
}

export type Project = { id: string; vehicleId: string; name: string | null; budget: number; stages: Stage[] }

export type ServiceInterval = { vehicleClass: string | null; intervalKm: number | null; intervalMonths: number | null; label: string }

export type OwnerDataset = {
  snapshotAt: string
  account: { id: string; name: string; region: string }
  conventions: Conventions
  garage: { id: string; name: string; location: string }
  members: Member[]
  vehicles: Vehicle[]
  records: Rec[]
  deletedRecords: DeletedRec[]
  reminders: Reminder[]
  documents: VehicleDocument[]
  projects: Project[]
  serviceIntervals: ServiceInterval[]
}

const dateOnly = (iso: string | null | undefined): string | null => (iso ? iso.slice(0, 10) : null)

export function normalizeConventions(raw: RawConventions): Conventions {
  return {
    region: raw.region,
    countryName: raw.countryName,
    currency: raw.currencyCode,
    distanceUnit: raw.distanceUnit === 'MI' ? 'mi' : 'km',
    volumeUnit: raw.volumeUnit === 'GALLON' ? 'gal' : 'L',
    dateFormat: raw.dateFormat || 'DD/MM/YYYY',
  }
}

/** 'UNASSIGNED' is the placeholder the apps send when no plate has been set. */
export function cleanPlate(plate: string | null | undefined): string | null {
  const p = plate?.trim()
  return p && p.toUpperCase() !== 'UNASSIGNED' ? p : null
}

function categoryFor(type: RecordType, expenseCategory: string | null): CategoryKey | null {
  switch (type) {
    case 'fuel':
      return 'fuel'
    case 'service':
      return 'service'
    case 'repair':
      return 'repairs'
    case 'odometer':
      return null
    case 'expense':
      switch (expenseCategory) {
        case 'FUEL':
          return 'fuel'
        case 'SERVICE':
          return 'service'
        case 'INSURANCE':
          return 'insurance'
        default:
          return 'other'
      }
  }
}

export function normalizeGarageData(raw: RawGarageReportData): OwnerDataset {
  return {
    snapshotAt: raw.generatedAt,
    account: raw.account,
    conventions: normalizeConventions(raw.conventions),
    garage: { id: raw.garage.id, name: raw.garage.name, location: raw.garage.location },
    members: raw.members.map((m) => ({
      id: m.id,
      accountId: m.accountId,
      name: m.displayName,
      role: m.role === 'OWNER' ? 'owner' : 'member',
      joinedAt: m.joinedAt,
      removedAt: m.removedAt,
    })),
    vehicles: raw.vehicles.map((v) => ({
      id: v.id,
      make: v.make,
      model: v.model,
      year: v.year,
      type: v.type === 'MOTORCYCLE' ? 'motorcycle' : 'car',
      usage: v.usage,
      plate: cleanPlate(v.plate),
      odometerKm: v.odometerKm,
      powertrain: v.powertrain,
      nextServiceDueKm: v.nextServiceDueKm,
      createdAt: v.createdAt,
    })),
    records: raw.records
      .filter((r) => r.date)
      .map((r) => {
        const expenseCategory = r.type === 'expense' ? r.category : null
        const litres = r.litres == null ? null : Number(r.litres)
        return {
          id: r.id,
          vehicleId: r.vehicleId,
          type: r.type,
          date: dateOnly(r.date)!,
          amount: r.type === 'odometer' ? 0 : toMinor(r.amount),
          litres: litres != null && Number.isFinite(litres) && litres > 0 ? litres : null,
          odometerKm: r.odometerKm > 0 ? r.odometerKm : null,
          category: categoryFor(r.type, expenseCategory),
          expenseCategory,
          description: r.description?.trim() || null,
          place: r.place?.trim() || null,
          notes: r.notes?.trim() || null,
          enteredByAccountId: r.enteredByAccountId,
          enteredByName: r.enteredByName?.trim() || 'Unknown',
          createdAt: r.createdAt,
          editedAt: r.editedAt,
        }
      }),
    deletedRecords: raw.deletedRecords
      .filter((r) => r.date)
      .map((r) => ({ id: r.id, vehicleId: r.vehicleId, type: r.type, date: dateOnly(r.date)!, amount: toMinor(r.amount), deletedAt: r.deletedAt })),
    reminders: raw.reminders.map((r) => ({ ...r, dueDate: dateOnly(r.dueDate) })),
    documents: raw.documents.map((d) => ({
      id: d.id,
      vehicleId: d.vehicleId,
      typeCode: d.typeCode,
      typeLabel: d.typeLabel,
      title: d.title,
      expiryDate: dateOnly(d.expiryDate),
    })),
    projects: raw.projects.map((p) => ({
      id: p.id,
      vehicleId: p.vehicleId,
      name: p.name,
      budget: toMinor(p.budget),
      stages: p.stages.map((s) => ({
        id: s.id,
        name: s.name,
        status: s.status === 'DONE' ? 'done' : s.status === 'IN_PROGRESS' ? 'in-progress' : 'not-started',
        modifications: s.modifications.map((m) => ({ id: m.id, name: m.name, cost: toMinor(m.cost) })),
        parts: s.parts.map((part) => ({
          id: part.id,
          name: part.name,
          cost: toMinor(part.cost),
          supplier: part.supplier,
          date: dateOnly(part.date),
        })),
      })),
    })),
    serviceIntervals: raw.serviceIntervals.map((s) => ({
      vehicleClass: s.vehicleClass,
      intervalKm: s.intervalKm,
      intervalMonths: s.intervalMonths,
      label: s.label,
    })),
  }
}

// ---------------------------------------------------------------------------
// Labels
// ---------------------------------------------------------------------------

export function vehicleName(v: Vehicle): string {
  return `${v.make} ${v.model}`.trim()
}

/** "KDG 441X", or the model when no plate has been set. */
export function vehicleShort(v: Vehicle): string {
  return v.plate ?? v.model
}

export function vehicleFull(v: Vehicle): string {
  return v.plate ? `${vehicleName(v)} · ${v.plate}` : vehicleName(v)
}

const EXPENSE_TITLE: Record<string, string> = {
  FUEL: 'Fuel',
  SERVICE: 'Service',
  INSURANCE: 'Insurance',
  LOAN: 'Loan repayment',
  OTHER: 'Other',
}

export function recordTitle(r: Rec): string {
  switch (r.type) {
    case 'fuel':
      return 'Fuel'
    case 'service':
      return 'Service'
    case 'repair':
      return r.description ?? 'Repair'
    case 'expense':
      return EXPENSE_TITLE[r.expenseCategory ?? 'OTHER'] ?? 'Other'
    case 'odometer':
      return 'Odometer reading'
  }
}

/** The work, line items or note behind a record — whatever was written down. */
export function recordDetail(r: Rec): string | null {
  switch (r.type) {
    case 'service':
      return r.description ?? r.notes
    case 'repair':
      return r.description ? r.notes : null
    default:
      return r.notes
  }
}

// ---------------------------------------------------------------------------
// Attribution — who entered each record (SHARE-01/02/07)
// ---------------------------------------------------------------------------

export type Person = {
  /** Stable grouping key: the account when known, otherwise the name. */
  key: string
  /** The person's name as the garage knows them now. */
  name: string
  /** No longer a member of the garage — their old records keep their name. */
  former: boolean
}

export type PersonIndex = (r: Rec) => Person

export function personIndex(members: Member[]): PersonIndex {
  const byAccount = new Map(members.map((m) => [m.accountId, m]))
  const byName = new Map(members.map((m) => [m.name.trim().toLowerCase(), m]))
  return (r) => {
    if (r.enteredByAccountId) {
      const member = byAccount.get(r.enteredByAccountId)
      return {
        key: `acct:${r.enteredByAccountId}`,
        name: member?.name ?? r.enteredByName,
        // An account with no membership row any more has left the garage.
        former: member ? member.removedAt != null : true,
      }
    }
    const member = byName.get(r.enteredByName.trim().toLowerCase())
    if (member) return { key: `acct:${member.accountId}`, name: member.name, former: member.removedAt != null }
    return { key: `name:${r.enteredByName.trim().toLowerCase()}`, name: r.enteredByName, former: false }
  }
}
