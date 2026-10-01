import { describe, expect, it } from 'vitest'
import { addMonths, previousPeriod, resolvePeriod, type PeriodPreset } from './period.ts'

const resolve = (preset: PeriodPreset, today: string, region = 'KE', extra: { start?: string; end?: string } = {}) =>
  resolvePeriod({ preset, ...extra }, { today, region })

describe('resolvePeriod', () => {
  it('gives whole calendar months for last month', () => {
    const p = resolve('lastMonth', '2026-10-01')
    expect(p).toMatchObject({ start: '2026-09-01', end: '2026-09-30', days: 30, label: 'September 2026' })
  })

  it('runs month, quarter and year "to date" up to today', () => {
    expect(resolve('thisMonth', '2026-10-01')).toMatchObject({ start: '2026-10-01', end: '2026-10-01', label: 'October 2026 to date' })
    expect(resolve('thisQuarter', '2026-11-15')).toMatchObject({ start: '2026-10-01', end: '2026-11-15', label: 'Q4 2026 to date' })
    expect(resolve('ytd', '2026-10-01')).toMatchObject({ start: '2026-01-01', end: '2026-10-01', days: 274 })
  })

  it('starts weeks on Monday', () => {
    // 1 Oct 2026 is a Thursday.
    expect(resolve('thisWeek', '2026-10-01')).toMatchObject({ start: '2026-09-28', end: '2026-10-01' })
    expect(resolve('lastWeek', '2026-10-01')).toMatchObject({ start: '2026-09-21', end: '2026-09-27' })
  })

  it('uses each market’s tax year (TAX-01)', () => {
    expect(resolve('lastTaxYear', '2026-10-01', 'KE')).toMatchObject({ start: '2025-01-01', end: '2025-12-31', label: 'Tax year 2025' })
    expect(resolve('lastTaxYear', '2026-10-01', 'GB')).toMatchObject({ start: '2025-04-06', end: '2026-04-05', label: 'Tax year 2025/26' })
    expect(resolve('lastTaxYear', '2026-10-01', 'UG')).toMatchObject({ start: '2025-07-01', end: '2026-06-30' })
    expect(resolve('thisTaxYear', '2026-02-15', 'ZA')).toMatchObject({ start: '2025-03-01', end: '2026-02-15', label: 'Tax year 2025/26 to date' })
  })

  it('covers the last twelve months inclusive', () => {
    expect(resolve('last12Months', '2026-10-01')).toMatchObject({ start: '2025-10-02', end: '2026-10-01', days: 365 })
  })

  it('orders custom dates and falls back on invalid ones', () => {
    expect(resolve('custom', '2026-10-01', 'KE', { start: '2026-05-01', end: '2026-02-01' })).toMatchObject({ start: '2026-02-01', end: '2026-05-01' })
    expect(resolve('custom', '2026-10-01', 'KE', { start: 'nonsense' })).toMatchObject({ start: '2026-01-01', end: '2026-10-01' })
  })

  it('starts "All records" at the earliest record', () => {
    expect(resolvePeriod({ preset: 'allTime' }, { today: '2026-10-01', region: 'KE', earliest: '2024-03-09' })).toMatchObject({ start: '2024-03-09', end: '2026-10-01' })
  })
})

describe('previousPeriod (OWN-04)', () => {
  const ctx = { today: '2026-10-01', region: 'KE' }

  it('compares a whole month with the month before', () => {
    expect(previousPeriod(resolve('lastMonth', '2026-10-01'), ctx)).toMatchObject({ start: '2026-08-01', end: '2026-08-31', label: 'August 2026' })
  })

  it('keeps the same calendar days for "to date" periods, clamping short months', () => {
    expect(previousPeriod(resolve('thisMonth', '2026-03-31'), ctx)).toMatchObject({ start: '2026-02-01', end: '2026-02-28' })
  })

  it('compares year to date with the same dates a year earlier, across leap years', () => {
    expect(previousPeriod(resolve('ytd', '2024-10-01'), ctx)).toMatchObject({ start: '2023-01-01', end: '2023-10-01' })
  })

  it('uses the same number of days immediately before for rolling periods', () => {
    const p = resolve('last12Months', '2026-10-01')
    const prev = previousPeriod(p, ctx)!
    expect(prev.end).toBe('2025-10-01')
    expect(prev.days).toBe(p.days)
  })

  it('has nothing to compare "All records" with', () => {
    expect(previousPeriod(resolvePeriod({ preset: 'allTime' }, { ...ctx, earliest: '2025-01-01' }), ctx)).toBeNull()
  })
})

describe('addMonths', () => {
  it('clamps to the end of shorter months', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28')
    expect(addMonths('2024-02-29', 12)).toBe('2025-02-28')
    expect(addMonths('2026-03-15', -14)).toBe('2025-01-15')
  })
})
