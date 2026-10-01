import { describe, expect, it } from 'vitest'
import { normalizeGarageData, type Rec } from './dataset.ts'
import { findDuplicates } from './duplicates.ts'
import { garagePayload } from './fixtures.test-util.ts'
import { makeFmt } from './fmt.ts'
import { minorToDecimalString, shares, toMinor } from './money.ts'
import { distanceInPeriod, readingsFor } from './odometer.ts'
import { adherence, isService, maintenanceGaps, nextService, serviceIntervalFor } from './service.ts'

describe('money', () => {
  it('parses API decimals exactly into minor units', () => {
    expect(toMinor('1234.50')).toBe(123450)
    expect(toMinor('0.07')).toBe(7)
    expect(toMinor('3000.25')).toBe(300025)
    expect(toMinor('-12.5')).toBe(-1250)
    expect(toMinor(null)).toBe(0)
    expect(minorToDecimalString(300025)).toBe('3000.25')
    expect(minorToDecimalString(-7)).toBe('-0.07')
  })

  it('rounds shares independently and reports the rounded sum instead of forcing 100', () => {
    const { pct, roundedSum } = shares([1, 1, 1], 3)
    expect(pct).toEqual([33, 33, 33])
    expect(roundedSum).toBe(99)
  })
})

describe('fmt (SYS-11)', () => {
  const base = { region: 'KE', countryName: 'Kenya', currency: 'KES', distanceUnit: 'km' as const, volumeUnit: 'L' as const, dateFormat: 'DD/MM/YYYY' }

  it('follows the region for grouping and the configured numeric date format', () => {
    const fmt = makeFmt(base, { fractionDigits: 0, timeZone: 'UTC' })
    expect(fmt.moneyCode(12345600)).toBe('KES 123,456')
    expect(fmt.date('2026-08-07')).toBe('07/08/2026')
    expect(fmt.dateLong('2026-08-07')).toBe('7 Aug 2026')
    expect(fmt.count(1, 'record')).toBe('1 record')
    expect(fmt.count(1204, 'record')).toBe('1,204 records')
    expect(makeFmt({ ...base, region: 'US', dateFormat: 'MM/DD/YYYY' }, { fractionDigits: 0 }).date('2026-08-07')).toBe('08/07/2026')
  })

  it('shows cents only when the document needs them', () => {
    expect(makeFmt(base, { fractionDigits: 2 }).money(300025)).toBe('3,000.25')
    expect(makeFmt(base, { fractionDigits: 0 }).money(300000)).toBe('3,000')
  })
})

describe('odometer distance (OWN-03 — never invent a figure)', () => {
  const r = (date: string, km: number) => ({ date, km })

  it('needs at least three readings', () => {
    const d = distanceInPeriod([r('2026-01-10', 10000), r('2026-03-10', 12000)], '2026-01-01', '2026-12-31')
    expect(d.ok).toBe(false)
    expect(!d.ok && d.reason).toContain('only 2 odometer readings in the period, 59 days apart')
  })

  it('refuses readings that go backwards', () => {
    const d = distanceInPeriod([r('2026-01-01', 10000), r('2026-02-01', 9000), r('2026-03-01', 11000)], '2026-01-01', '2026-12-31')
    expect(!d.ok && d.reason).toContain('go backwards')
  })

  it('refuses a span that is too short or a distance that is too small', () => {
    const short = distanceInPeriod([r('2026-01-01', 10000), r('2026-01-05', 10400), r('2026-01-09', 10800)], '2026-01-01', '2026-12-31')
    expect(!short.ok && short.reason).toContain('span only 8 days')
    const tiny = distanceInPeriod([r('2026-01-01', 10000), r('2026-02-01', 10020), r('2026-03-01', 10050)], '2026-01-01', '2026-12-31')
    expect(!tiny.ok && tiny.reason).toContain('only 50 km')
  })

  it('measures between the first and last reading inside the period, ignoring repeats', () => {
    const data = normalizeGarageData(garagePayload())
    const readings = readingsFor(data.records, 'car1')
    // The duplicated September fill has the same date and reading, so it counts once.
    expect(readings.filter((x) => x.date === '2026-09-10')).toHaveLength(1)
    const d = distanceInPeriod(readings, '2026-01-01', '2026-10-01')
    expect(d).toMatchObject({ ok: true, km: 8000, first: { date: '2026-01-10' }, last: { date: '2026-09-10' } })
  })
})

describe('service interval, adherence and gaps (WNTY-01/02, OWN-09)', () => {
  const data = normalizeGarageData(garagePayload())
  const car1 = data.vehicles.find((v) => v.id === 'car1')!
  const car2 = data.vehicles.find((v) => v.id === 'car2')!
  const services = data.records.filter((x: Rec) => x.vehicleId === 'car1' && isService(x)).sort((a, b) => (a.date < b.date ? -1 : 1))

  it('takes the distance from the vehicle when it was set at the last service, months from the class default', () => {
    expect(serviceIntervalFor(car1, services, data.serviceIntervals)).toMatchObject({ km: 5000, months: 6, kmSource: 'vehicle' })
    expect(serviceIntervalFor(car2, [], data.serviceIntervals)).toMatchObject({ km: 10000, months: 6, kmSource: 'default' })
  })

  it('measures each service against the one before', () => {
    const basis = serviceIntervalFor(car1, services, data.serviceIntervals)
    const rows = adherence(services, basis)
    expect(rows.map((x) => x.result)).toEqual(['first', 'late'])
    expect(rows[1]).toMatchObject({ dueKm: 15500, dueDate: '2026-07-20', lateKm: 700, lateDays: 5 })
  })

  it('reads the next service forward from the last', () => {
    const basis = serviceIntervalFor(car1, services, data.serviceIntervals)
    expect(nextService(services, basis, 18000, '2026-10-01')).toMatchObject({ dueKm: 21200, dueDate: '2027-01-25', kmLeft: 3200, daysLeft: 116 })
  })

  it('finds stretches longer than the interval with no service or repair, from their real start', () => {
    const basis = serviceIntervalFor(car1, services, data.serviceIntervals)
    const gaps = maintenanceGaps(data.records.filter((x) => x.vehicleId === 'car1'), basis, '2026-01-01', '2026-10-01')
    expect(gaps).toEqual([{ from: '2025-06-10', to: '2026-01-20', fromLabel: 'first record', open: false }])
  })
})

describe('duplicates (SYS-15)', () => {
  it('groups same vehicle, same day, same kind, similar amount', () => {
    const data = normalizeGarageData(garagePayload())
    const groups = findDuplicates(data.records)
    expect(groups).toHaveLength(1)
    expect(groups[0]!.records.map((x) => x.id).sort()).toEqual(['c1-fuel-9', 'c1-fuel-9-dup'])
  })
})
