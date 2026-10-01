import type { RawGarageReportData, RawWorkshopReportData } from '../api/types.ts'

/**
 * Hand-built API payloads for the engine tests. Kept small and explicit so a
 * failing assertion can be checked by reading the fixture.
 */

export const TODAY = '2026-10-01'

const KE = {
  region: 'KE',
  countryName: 'Kenya',
  currencyCode: 'KES',
  currencySymbol: 'KSh',
  currencySymbolPlacement: 'BEFORE' as const,
  distanceUnit: 'KM' as const,
  volumeUnit: 'LITRE' as const,
  dateFormat: 'DD/MM/YYYY',
  source: 'country_config' as const,
}

type RawRecord = RawGarageReportData['records'][number]

let seq = 0
function rec(partial: Partial<RawRecord> & Pick<RawRecord, 'vehicleId' | 'type' | 'date'>): RawRecord {
  seq += 1
  return {
    id: partial.id ?? `r${String(seq).padStart(3, '0')}`,
    amount: null,
    litres: null,
    odometerKm: 0,
    category: null,
    description: null,
    place: null,
    notes: null,
    enteredByAccountId: 'acct-owner',
    enteredByName: 'Owner One',
    createdAt: `${partial.date}T09:00:00.000Z`,
    editedAt: null,
    ...partial,
    date: `${partial.date}T00:00:00.000Z`,
  }
}

export const fuel = (id: string, vehicleId: string, date: string, amount: string, km: number, extra: Partial<RawRecord> = {}) =>
  rec({ id, vehicleId, type: 'fuel', date, amount, odometerKm: km, litres: '40.000', category: 'FUEL', place: 'Shell Karen', ...extra })

export const service = (id: string, vehicleId: string, date: string, amount: string, km: number, extra: Partial<RawRecord> = {}) =>
  rec({ id, vehicleId, type: 'service', date, amount, odometerKm: km, category: 'SERVICE', description: 'Oil and filters', place: 'Main Dealer', ...extra })

export const repair = (id: string, vehicleId: string, date: string, amount: string, km: number, extra: Partial<RawRecord> = {}) =>
  rec({ id, vehicleId, type: 'repair', date, amount, odometerKm: km, category: 'REPAIR', description: 'Brake pads', place: 'Corner Garage', ...extra })

export const expense = (id: string, vehicleId: string, date: string, amount: string, category: string, extra: Partial<RawRecord> = {}) =>
  rec({ id, vehicleId, type: 'expense', date, amount, category, place: 'Insurer', ...extra })

/**
 * A three-vehicle garage with three members (one former). CAR1 has a full
 * year of history; CAR2 a little; the bike only a couple of readings.
 */
export function garagePayload(): RawGarageReportData {
  seq = 0
  const records: RawRecord[] = []
  // CAR1: monthly fuel Jan–Sep 2026, 1,000 km a month from 10,000 km.
  for (let m = 1; m <= 9; m += 1) {
    const date = `2026-${String(m).padStart(2, '0')}-10`
    records.push(fuel(`c1-fuel-${m}`, 'car1', date, '5000.00', 10000 + (m - 1) * 1000, m === 4 ? { enteredByAccountId: 'acct-member', enteredByName: 'Member Two' } : {}))
  }
  // Services: on time at 10,500 km, then late (due 15,500 km, done 16,200 km).
  records.push(service('c1-svc-1', 'car1', '2026-01-20', '12000.00', 10500, { description: 'Engine oil (fluid, KES 7,000); Oil filter (part, KES 1,500); Labour (labour, KES 3,500)' }))
  records.push(service('c1-svc-2', 'car1', '2026-07-25', '15000.00', 16200, { createdAt: '2026-08-05T10:00:00.000Z' }))
  records.push(repair('c1-rep-1', 'car1', '2026-05-14', '20000.00', 14400, { enteredByAccountId: 'acct-former', enteredByName: 'Former Three' }))
  records.push(expense('c1-ins', 'car1', '2026-02-01', '30000.00', 'INSURANCE', { odometerKm: 10700, editedAt: '2026-02-03T08:00:00.000Z' }))
  // A duplicate of the September fill, logged by the member.
  records.push(fuel('c1-fuel-9-dup', 'car1', '2026-09-10', '5000.00', 18000, { enteredByAccountId: 'acct-member', enteredByName: 'Member Two' }))
  // Previous year, for comparisons.
  records.push(fuel('c1-fuel-2025', 'car1', '2025-06-10', '4000.00', 6000))
  // CAR2: two fills only — not enough for per-km.
  records.push(fuel('c2-fuel-1', 'car2', '2026-03-03', '3000.25', 50000))
  records.push(fuel('c2-fuel-2', 'car2', '2026-06-03', '3100.00', 52000))
  // BIKE: odometer readings only.
  records.push(rec({ id: 'bike-odo-1', vehicleId: 'bike', type: 'odometer', date: '2026-04-01', odometerKm: 3000 }))
  return {
    generatedAt: '2026-10-01T06:00:00.000Z',
    account: { id: 'acct-owner', name: 'Owner One', region: 'KE' },
    conventions: KE,
    garage: { id: 'g1', name: 'Test Garage', location: 'Nairobi', ownerId: 'acct-owner', createdAt: '2025-01-01T00:00:00.000Z' },
    members: [
      { id: 'm1', accountId: 'acct-owner', displayName: 'Owner One', role: 'OWNER', joinedAt: '2025-01-01T00:00:00.000Z', removedAt: null },
      { id: 'm2', accountId: 'acct-member', displayName: 'Member Two', role: 'MEMBER', joinedAt: '2025-02-01T00:00:00.000Z', removedAt: null },
      { id: 'm3', accountId: 'acct-former', displayName: 'Former Three', role: 'MEMBER', joinedAt: '2025-02-01T00:00:00.000Z', removedAt: '2026-06-01T00:00:00.000Z' },
    ],
    vehicles: [
      { id: 'car1', make: 'Toyota', model: 'Prado', year: 2018, type: 'CAR', usage: 'DAILY', plate: 'KAA 001A', odometerKm: 18000, powertrain: 'DIESEL', nextServiceDueKm: 21200, createdAt: '2025-01-01T00:00:00.000Z' },
      { id: 'car2', make: 'Mazda', model: 'Demio', year: 2015, type: 'CAR', usage: 'DAILY', plate: 'KAA 002B', odometerKm: 52000, powertrain: 'PETROL', nextServiceDueKm: null, createdAt: '2025-01-01T00:00:00.000Z' },
      { id: 'bike', make: 'Yamaha', model: 'XT660Z', year: 2015, type: 'MOTORCYCLE', usage: 'WEEKEND', plate: 'UNASSIGNED', odometerKm: 3000, powertrain: 'PETROL', nextServiceDueKm: null, createdAt: '2025-01-01T00:00:00.000Z' },
    ],
    records,
    deletedRecords: [{ id: 'c1-deleted', vehicleId: 'car1', type: 'expense', date: '2026-03-05T00:00:00.000Z', amount: '700.00', deletedAt: '2026-03-06T00:00:00.000Z' }],
    reminders: [],
    documents: [
      { id: 'd1', vehicleId: 'car1', typeCode: 'insurance', typeLabel: 'Insurance', title: 'Comprehensive cover', expiryDate: '2026-10-20T00:00:00.000Z', addedAt: '2026-02-01T00:00:00.000Z' },
      { id: 'd2', vehicleId: 'car1', typeCode: 'inspection', typeLabel: 'Inspection', title: 'Inspection certificate', expiryDate: '2026-09-25T00:00:00.000Z', addedAt: '2026-02-01T00:00:00.000Z' },
    ],
    projects: [],
    serviceIntervals: [
      { code: 'car_standard', label: 'Car', vehicleClass: 'CAR', intervalKm: 10000, intervalMonths: 6 },
      { code: 'motorcycle_standard', label: 'Motorcycle', vehicleClass: 'MOTORCYCLE', intervalKm: 6000, intervalMonths: 6 },
    ],
  }
}

export function workshopPayload(): RawWorkshopReportData {
  const invoice = (
    id: string,
    jobId: string,
    createdAt: string,
    total: string,
    payments: { amount: string; method: string; paidAt: string }[],
  ): RawWorkshopReportData['invoices'][number] => ({
    id,
    jobId,
    estimateId: null,
    vehicleId: 'v',
    status: 'UNPAID',
    total,
    dueDate: new Date(Date.parse(createdAt) + 14 * 86_400_000).toISOString(),
    createdAt,
    items: [],
    payments: payments.map((p, i) => ({ id: `${id}-p${i}`, ...p })),
  })
  const job = (id: string, customerId: string, vehicleId: string, createdAt: string, mechanics: string[]): RawWorkshopReportData['jobs'][number] => ({
    id,
    customerId,
    vehicleId,
    vehicle: { make: 'Toyota', model: 'Probox', plate: vehicleId.toUpperCase() },
    vehicleDescription: null,
    faultDescription: `Fault on ${id}`,
    status: 'INVOICED',
    createdAt,
    updatedAt: createdAt,
    lines: [{ id: `${id}-l`, kind: 'LABOUR', description: 'Labour', cost: '1000.00' }],
    assignments: mechanics.map((m) => ({ workshopMemberId: m, assignedAt: createdAt })),
    statusEvents: [],
  })
  return {
    generatedAt: '2026-10-01T06:00:00.000Z',
    account: { id: 'acct-owner', name: 'Owner One', region: 'KE' },
    conventions: KE,
    workshop: { id: 'w1', name: 'Test Motors', createdAt: '2025-01-01T00:00:00.000Z' },
    members: [
      { id: 'wm1', accountId: 'acct-owner', displayName: 'Owner One', role: 'OWNER', joinedAt: null },
      { id: 'wm2', accountId: 'acct-mech', displayName: 'Mech Two', role: 'MECHANIC', joinedAt: null },
    ],
    customers: [
      { id: 'cust1', name: 'Alpha Ltd', phone: '0700 000 001', createdAt: null },
      { id: 'cust2', name: 'Beta Kamau', phone: null, createdAt: null },
    ],
    jobs: [
      job('j0', 'cust1', 'v1', '2026-07-01T08:00:00.000Z', ['wm1']),
      job('j1', 'cust1', 'v1', '2026-09-02T08:00:00.000Z', ['wm1', 'wm2']),
      job('j2', 'cust2', 'v2', '2026-09-15T08:00:00.000Z', ['wm2']),
      job('j3', 'cust1', 'v1', '2026-09-28T08:00:00.000Z', ['wm2']),
    ],
    estimates: [
      { id: 'e1', jobId: 'j1', vehicleId: 'v1', status: 'APPROVED', total: '10001.00', createdAt: '2026-09-02T09:00:00.000Z', items: [{ id: 'e1i', description: 'Service', cost: '10001.00' }], decisions: [] },
      { id: 'e2', jobId: 'j2', vehicleId: 'v2', status: 'DECLINED', total: '5000.00', createdAt: '2026-09-15T09:00:00.000Z', items: [{ id: 'e2i', description: 'Shocks', cost: '5000.00' }], decisions: [] },
    ],
    invoices: [
      // Before the period: part paid, so it carries into a statement's opening balance and ageing.
      invoice('i0', 'j0', '2026-07-02T15:00:00.000Z', '4000.00', [{ amount: '1000.00', method: 'CASH', paidAt: '2026-07-02T16:00:00.000Z' }]),
      invoice('i1', 'j1', '2026-09-04T15:00:00.000Z', '10001.00', [{ amount: '10001.00', method: 'MOBILE_MONEY', paidAt: '2026-09-04T16:00:00.000Z' }]),
      invoice('i2', 'j2', '2026-09-16T15:00:00.000Z', '6000.00', [{ amount: '2000.00', method: 'CASH', paidAt: '2026-09-29T10:00:00.000Z' }]),
      invoice('i3', 'j3', '2026-09-29T15:00:00.000Z', '3000.00', []),
    ],
  }
}
