import type { RawJobStatus, RawWorkshopReportData } from '../api/types.ts'
import { cleanPlate, normalizeConventions } from './dataset.ts'
import type { Conventions } from './fmt.ts'
import { toMinor } from './money.ts'

/**
 * The workshop-side dataset the work report is built from: the snapshot
 * from GET /workshops/:id/report-data, normalised once. Job, invoice and
 * payment times stay as timestamps — the engine places them on calendar
 * days in the reader's time zone.
 */

export type JobStatus = RawJobStatus

export type WorkJob = {
  id: string
  customerId: string
  /** Groups jobs for the same vehicle: the Carma vehicle id, or its description. */
  vehicleKey: string
  vehicleLabel: string
  fault: string
  status: JobStatus
  createdAt: string
  lines: { kind: string; description: string; cost: number }[]
  mechanicIds: string[]
}

export type WorkEstimate = {
  id: string
  jobId: string
  status: 'PENDING' | 'APPROVED' | 'DECLINED'
  total: number
  createdAt: string
  items: { description: string; cost: number }[]
}

export type WorkPayment = { id: string; amount: number; method: string; paidAt: string }

export type WorkInvoice = {
  id: string
  jobId: string
  total: number
  dueDate: string | null
  createdAt: string
  payments: WorkPayment[]
}

export type WorkDataset = {
  snapshotAt: string
  account: { id: string; name: string; region: string }
  conventions: Conventions
  workshop: { id: string; name: string }
  members: { id: string; name: string; role: string }[]
  customers: { id: string; name: string; phone: string | null }[]
  jobs: WorkJob[]
  estimates: WorkEstimate[]
  invoices: WorkInvoice[]
}

export function normalizeWorkshopData(raw: RawWorkshopReportData): WorkDataset {
  const stamp = (ts: string | null, fallback: string) => ts ?? fallback
  return {
    snapshotAt: raw.generatedAt,
    account: raw.account,
    conventions: normalizeConventions(raw.conventions),
    workshop: { id: raw.workshop.id, name: raw.workshop.name },
    members: raw.members.map((m) => ({ id: m.id, name: m.displayName, role: m.role })),
    customers: raw.customers.map((c) => ({ id: c.id, name: c.name, phone: c.phone })),
    jobs: raw.jobs.map((j) => {
      const plate = cleanPlate(j.vehicle?.plate)
      const label = j.vehicle
        ? `${j.vehicle.make} ${j.vehicle.model}${plate ? ` · ${plate}` : ''}`
        : j.vehicleDescription?.trim() || 'Vehicle not recorded'
      return {
        id: j.id,
        customerId: j.customerId,
        vehicleKey: j.vehicleId ?? `desc:${(j.vehicleDescription ?? j.id).trim().toLowerCase()}`,
        vehicleLabel: label,
        fault: j.faultDescription,
        status: j.status,
        createdAt: stamp(j.createdAt, raw.generatedAt),
        lines: j.lines.map((l) => ({ kind: l.kind, description: l.description, cost: toMinor(l.cost) })),
        mechanicIds: j.assignments.map((a) => a.workshopMemberId),
      }
    }),
    estimates: raw.estimates.map((e) => ({
      id: e.id,
      jobId: e.jobId,
      status: e.status,
      total: toMinor(e.total),
      createdAt: stamp(e.createdAt, raw.generatedAt),
      items: e.items.map((i) => ({ description: i.description, cost: toMinor(i.cost) })),
    })),
    invoices: raw.invoices.map((inv) => ({
      id: inv.id,
      jobId: inv.jobId,
      total: toMinor(inv.total),
      dueDate: inv.dueDate,
      createdAt: stamp(inv.createdAt, raw.generatedAt),
      payments: inv.payments.map((p) => ({ id: p.id, amount: toMinor(p.amount), method: p.method, paidAt: stamp(p.paidAt, raw.generatedAt) })),
    })),
  }
}
