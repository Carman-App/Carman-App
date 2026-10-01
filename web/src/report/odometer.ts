import type { Rec } from './dataset.ts'
import { daysBetween } from './period.ts'

/**
 * Distance from odometer readings — the basis for cost per kilometre
 * (OWN-03, FLEET-03). One rule for every vehicle, so a fleet comparison
 * means something, and a figure is withheld with its reason rather than
 * invented when the readings can't carry it ("It must not compute what it
 * cannot support").
 */

export type Reading = { date: string; km: number }

/** Thresholds, named so they're easy to find and argue with. */
export const MIN_READINGS = 3
export const MIN_WINDOW_DAYS = 30
export const MIN_DISTANCE_KM = 100

/** Every distinct (date, km) observation for a vehicle, oldest first. Any record type can carry one. */
export function readingsFor(records: Rec[], vehicleId: string): Reading[] {
  const seen = new Set<string>()
  const out: Reading[] = []
  for (const r of records) {
    if (r.vehicleId !== vehicleId || r.odometerKm == null) continue
    const key = `${r.date}|${r.odometerKm}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ date: r.date, km: r.odometerKm })
  }
  return out.sort((a, b) => (a.date === b.date ? a.km - b.km : a.date < b.date ? -1 : 1))
}

export type Distance =
  | { ok: true; first: Reading; last: Reading; km: number; readings: number }
  | { ok: false; reason: string; readings: number }

/**
 * Distance covered between the first and last readings inside [start, end].
 * Spend is later matched to exactly that window, so the figure never divides
 * a whole period's cost by part of its distance.
 */
export function distanceInPeriod(all: Reading[], start: string, end: string): Distance {
  const inside = all.filter((r) => r.date >= start && r.date <= end)
  const n = inside.length
  if (n === 0) return { ok: false, readings: 0, reason: 'there are no odometer readings in the period' }
  if (n < MIN_READINGS) {
    const first = inside[0]!
    const last = inside[n - 1]!
    const apart = n === 2 ? `, ${daysBetween(first.date, last.date)} days apart` : ''
    return {
      ok: false,
      readings: n,
      reason: `there ${n === 1 ? 'is only one odometer reading' : `are only ${n} odometer readings`} in the period${apart}; at least ${MIN_READINGS} are needed`,
    }
  }
  for (let i = 1; i < n; i += 1) {
    if (inside[i]!.km < inside[i - 1]!.km) {
      return {
        ok: false,
        readings: n,
        reason: `the odometer readings go backwards (${inside[i - 1]!.km} km, then ${inside[i]!.km} km on ${inside[i]!.date}), so the distance can't be trusted`,
      }
    }
  }
  const first = inside[0]!
  const last = inside[n - 1]!
  const span = daysBetween(first.date, last.date)
  if (span < MIN_WINDOW_DAYS) {
    return { ok: false, readings: n, reason: `the odometer readings span only ${span} days; at least ${MIN_WINDOW_DAYS} are needed` }
  }
  const km = last.km - first.km
  if (km < MIN_DISTANCE_KM) {
    return { ok: false, readings: n, reason: `only ${km} km was recorded in the period, too little for a per-kilometre figure` }
  }
  return { ok: true, first, last, km, readings: n }
}

/** Spend dated inside the distance window, so cost and distance cover the same days. */
export function spendInWindow(items: Rec[], vehicleId: string, d: Extract<Distance, { ok: true }>, pick?: (r: Rec) => boolean): number {
  let total = 0
  for (const r of items) {
    if (r.vehicleId !== vehicleId || r.date < d.first.date || r.date > d.last.date) continue
    if (pick && !pick(r)) continue
    total += r.amount
  }
  return total
}
