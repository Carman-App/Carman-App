import type { Rec, ServiceInterval, Vehicle } from './dataset.ts'
import { addMonths, daysBetween } from './period.ts'

/**
 * Service history, interval adherence and coverage gaps — the evidence a
 * buyer, insurer or warranty assessor reads (OWN-08, OWN-09, WNTY-01,
 * WNTY-02). Only service records reset the interval; repairs are
 * maintenance for coverage but don't count as a scheduled service.
 */

export type IntervalBasis = {
  km: number | null
  months: number | null
  /** Where the distance came from — printed with the basis on the document. */
  kmSource: 'vehicle' | 'default' | null
  /** "cars" / "motorcycles" — the class whose default applies. */
  classLabel: string
}

export const isService = (r: Rec): boolean => r.type === 'service' || (r.type === 'expense' && r.expenseCategory === 'SERVICE')
export const isMaintenance = (r: Rec): boolean => isService(r) || r.type === 'repair'

/**
 * The interval a vehicle is held to. Distance comes from the vehicle itself
 * when its next-service reading was set at the last service (the mobile
 * service form does this); otherwise, and for months, from admin's
 * service_intervals config list for the vehicle class.
 */
export function serviceIntervalFor(vehicle: Vehicle, services: Rec[], defaults: ServiceInterval[]): IntervalBasis {
  const cls = vehicle.type === 'motorcycle' ? 'MOTORCYCLE' : 'CAR'
  const fallback = defaults.find((d) => d.vehicleClass === cls) ?? null
  const lastWithKm = [...services].reverse().find((s) => s.odometerKm != null)
  const own =
    vehicle.nextServiceDueKm != null && lastWithKm?.odometerKm != null ? vehicle.nextServiceDueKm - lastWithKm.odometerKm : null
  const ownKm = own != null && own >= 1000 && own <= 50000 ? own : null

  const km = ownKm ?? fallback?.intervalKm ?? null
  return {
    km,
    months: fallback?.intervalMonths ?? null,
    kmSource: ownKm != null ? 'vehicle' : km != null ? 'default' : null,
    classLabel: vehicle.type === 'motorcycle' ? 'motorcycles' : 'cars',
  }
}

export type AdherenceRow = {
  record: Rec
  dueKm: number | null
  dueDate: string | null
  result: 'first' | 'on-time' | 'late' | 'unknown'
  lateKm: number
  lateDays: number
}

/** Each service against the interval it was due at (WNTY-01). `services` oldest first. */
export function adherence(services: Rec[], basis: IntervalBasis): AdherenceRow[] {
  return services.map((s, i) => {
    const prev = i > 0 ? services[i - 1]! : null
    if (!prev) return { record: s, dueKm: null, dueDate: null, result: 'first', lateKm: 0, lateDays: 0 }
    const dueKm = basis.km != null && prev.odometerKm != null ? prev.odometerKm + basis.km : null
    const dueDate = basis.months != null ? addMonths(prev.date, basis.months) : null
    if (dueKm == null && dueDate == null) return { record: s, dueKm, dueDate, result: 'unknown', lateKm: 0, lateDays: 0 }
    const lateKm = dueKm != null && s.odometerKm != null ? Math.max(0, s.odometerKm - dueKm) : 0
    const lateDays = dueDate != null ? Math.max(0, daysBetween(dueDate, s.date)) : 0
    return { record: s, dueKm, dueDate, result: lateKm > 0 || lateDays > 0 ? 'late' : 'on-time', lateKm, lateDays }
  })
}

export type NextService = {
  dueKm: number | null
  dueDate: string | null
  /** Positive = remaining, negative = overdue. */
  kmLeft: number | null
  daysLeft: number | null
}

/** The next service, read forward from the last one (WNTY-02). */
export function nextService(services: Rec[], basis: IntervalBasis, currentKm: number | null, today: string): NextService | null {
  const last = services[services.length - 1]
  if (!last) return null
  const dueKm = basis.km != null && last.odometerKm != null ? last.odometerKm + basis.km : null
  const dueDate = basis.months != null ? addMonths(last.date, basis.months) : null
  if (dueKm == null && dueDate == null) return null
  return {
    dueKm,
    dueDate,
    kmLeft: dueKm != null && currentKm != null ? dueKm - currentKm : null,
    daysLeft: dueDate != null ? daysBetween(today, dueDate) : null,
  }
}

export type Gap = { from: string; to: string; fromLabel: 'first record' | 'maintenance'; open: boolean }

/**
 * Stretches longer than the service interval with no service or repair in
 * them (OWN-09), measured across the vehicle's whole history so a gap that
 * started before the period is shown with its real start, and kept when it
 * overlaps the period.
 */
export function maintenanceGaps(vehicleRecords: Rec[], basis: IntervalBasis, start: string, end: string): Gap[] {
  if (basis.months == null) return []
  const upToEnd = vehicleRecords.filter((r) => r.date <= end)
  const first = upToEnd.reduce<string | null>((min, r) => (min == null || r.date < min ? r.date : min), null)
  if (!first) return []
  const dates = [...new Set(upToEnd.filter(isMaintenance).map((r) => r.date))].sort()
  const gaps: Gap[] = []
  let prev = first
  let prevKind: Gap['fromLabel'] = 'first record'
  for (const d of dates) {
    if (d > addMonths(prev, basis.months)) gaps.push({ from: prev, to: d, fromLabel: prevKind, open: false })
    prev = d
    prevKind = 'maintenance'
  }
  if (end > addMonths(prev, basis.months)) gaps.push({ from: prev, to: end, fromLabel: prevKind, open: true })
  return gaps.filter((g) => g.to >= start && g.from <= end)
}
