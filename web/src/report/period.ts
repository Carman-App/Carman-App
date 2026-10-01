/**
 * Report periods. All dates are ISO calendar dates ("YYYY-MM-DD"), inclusive
 * at both ends, computed in UTC so a period means the same days for every
 * reader. "Today" is always passed in — nothing here reads the clock, which
 * keeps generation deterministic (SYS-05).
 */

export type PeriodPreset =
  | 'today'
  | 'thisWeek'
  | 'lastWeek'
  | 'thisMonth'
  | 'lastMonth'
  | 'thisQuarter'
  | 'lastQuarter'
  | 'ytd'
  | 'last12Months'
  | 'thisTaxYear'
  | 'lastTaxYear'
  | 'allTime'
  | 'custom'

export type PeriodSpec = { preset: PeriodPreset; start?: string; end?: string }

export type Period = {
  preset: PeriodPreset
  start: string
  end: string
  days: number
  label: string
}

export type FiscalStart = { month: number; day: number }

/**
 * Start of the personal tax year per market (TAX-01). Kept in one table so a
 * new market is one line; it belongs in admin's Country config once that
 * table grows a fiscal-year field.
 */
export const FISCAL_YEAR_START: Record<string, FiscalStart> = {
  KE: { month: 1, day: 1 },
  UG: { month: 7, day: 1 },
  TZ: { month: 1, day: 1 },
  NG: { month: 1, day: 1 },
  ZA: { month: 3, day: 1 },
  US: { month: 1, day: 1 },
  GB: { month: 4, day: 6 },
}

export function fiscalStartFor(region: string): FiscalStart {
  return FISCAL_YEAR_START[region.toUpperCase()] ?? { month: 1, day: 1 }
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

// ---------------------------------------------------------------------------
// Calendar arithmetic on ISO dates
// ---------------------------------------------------------------------------

const DAY_MS = 86_400_000

function parts(iso: string): [number, number, number] {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  return [y ?? 1970, m ?? 1, d ?? 1]
}

function make(y: number, m: number, d: number): string {
  // Normalise overflow (month 13, day 0, …) through Date.UTC.
  const t = new Date(Date.UTC(y, m - 1, d))
  return t.toISOString().slice(0, 10)
}

export function addDays(iso: string, n: number): string {
  const [y, m, d] = parts(iso)
  return make(y, m, d + n)
}

function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate()
}

/** Add calendar months, clamping the day (31 Jan + 1 month = 28/29 Feb). */
export function addMonths(iso: string, n: number): string {
  const [y, m, d] = parts(iso)
  const total = y * 12 + (m - 1) + n
  const ny = Math.floor(total / 12)
  const nm = (total % 12) + 1
  return make(ny, nm, Math.min(d, daysInMonth(ny, nm)))
}

/** Inclusive day count from a to b. */
export function daySpan(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY_MS) + 1
}

/** Whole days from a to b (b − a). */
export function daysBetween(a: string, b: string): number {
  return daySpan(a, b) - 1
}

export function isIsoDate(value: string | undefined | null): value is string {
  return !!value && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`))
}

function startOfMonth(iso: string): string {
  const [y, m] = parts(iso)
  return make(y, m, 1)
}

function endOfMonth(iso: string): string {
  const [y, m] = parts(iso)
  return make(y, m, daysInMonth(y, m))
}

function startOfQuarter(iso: string): string {
  const [y, m] = parts(iso)
  return make(y, Math.floor((m - 1) / 3) * 3 + 1, 1)
}

function quarterOf(iso: string): number {
  return Math.floor((parts(iso)[1] - 1) / 3) + 1
}

/** Weeks start on Monday. */
function startOfWeek(iso: string): string {
  const dow = new Date(`${iso}T00:00:00Z`).getUTCDay() // 0 = Sunday
  return addDays(iso, -((dow + 6) % 7))
}

function fiscalYearStartFor(iso: string, fs: FiscalStart): string {
  const [y] = parts(iso)
  const thisYears = make(y, fs.month, fs.day)
  return iso >= thisYears ? thisYears : make(y - 1, fs.month, fs.day)
}

function fiscalLabel(fyStart: string, fs: FiscalStart): string {
  const [y] = parts(fyStart)
  return fs.month === 1 && fs.day === 1 ? String(y) : `${y}/${String(y + 1).slice(2)}`
}

function period(preset: PeriodPreset, start: string, end: string, label: string): Period {
  return { preset, start, end, days: daySpan(start, end), label }
}

// ---------------------------------------------------------------------------
// Presets
// ---------------------------------------------------------------------------

export type PeriodContext = {
  today: string
  region: string
  /** Earliest record date in scope, for "All records". */
  earliest?: string | null
}

export function resolvePeriod(spec: PeriodSpec, ctx: PeriodContext): Period {
  const { today } = ctx
  const fs = fiscalStartFor(ctx.region)
  const [year, month] = parts(today)
  switch (spec.preset) {
    case 'today':
      return period('today', today, today, 'Today')
    case 'thisWeek':
      return period('thisWeek', startOfWeek(today), today, 'This week')
    case 'lastWeek': {
      const start = addDays(startOfWeek(today), -7)
      return period('lastWeek', start, addDays(start, 6), 'Last week')
    }
    case 'thisMonth':
      return period('thisMonth', startOfMonth(today), today, `${MONTHS[month - 1]} ${year} to date`)
    case 'lastMonth': {
      const start = addMonths(startOfMonth(today), -1)
      const [y, m] = parts(start)
      return period('lastMonth', start, endOfMonth(start), `${MONTHS[m - 1]} ${y}`)
    }
    case 'thisQuarter':
      return period('thisQuarter', startOfQuarter(today), today, `Q${quarterOf(today)} ${year} to date`)
    case 'lastQuarter': {
      const start = addMonths(startOfQuarter(today), -3)
      return period('lastQuarter', start, addDays(addMonths(start, 3), -1), `Q${quarterOf(start)} ${parts(start)[0]}`)
    }
    case 'ytd':
      return period('ytd', make(year, 1, 1), today, `${year} to date`)
    case 'last12Months':
      return period('last12Months', addDays(addMonths(today, -12), 1), today, 'Last 12 months')
    case 'thisTaxYear': {
      const start = fiscalYearStartFor(today, fs)
      return period('thisTaxYear', start, today, `Tax year ${fiscalLabel(start, fs)} to date`)
    }
    case 'lastTaxYear': {
      const start = addMonths(fiscalYearStartFor(today, fs), -12)
      return period('lastTaxYear', start, addDays(addMonths(start, 12), -1), `Tax year ${fiscalLabel(start, fs)}`)
    }
    case 'allTime': {
      const start = ctx.earliest && ctx.earliest < today ? ctx.earliest : today
      return period('allTime', start, today, 'All records')
    }
    case 'custom': {
      let start = isIsoDate(spec.start) ? spec.start : make(year, 1, 1)
      let end = isIsoDate(spec.end) ? spec.end : today
      if (start > end) [start, end] = [end, start]
      return period('custom', start, end, 'Chosen dates')
    }
  }
}

/**
 * The comparison period (OWN-04): the same length, immediately prior. Periods
 * that are a whole calendar unit compare with the previous whole unit; "to
 * date" periods compare with the same span of the previous unit; anything
 * else with the same number of days just before. "All records" has none.
 */
export function previousPeriod(p: Period, ctx: PeriodContext): Period | null {
  const fs = fiscalStartFor(ctx.region)
  // Whole units step back to the previous whole unit; "to date" periods keep
  // the same calendar dates one unit earlier (1–15 Oct vs 1–15 Sep), which
  // stays right across month lengths and leap years.
  const back = (months: number, whole: boolean, label: (start: string) => string): Period => {
    const start = addMonths(p.start, -months)
    const end = whole ? addDays(p.start, -1) : addMonths(p.end, -months)
    return period(p.preset, start, end, label(start))
  }
  const monthLabel = (s: string) => `${MONTHS[parts(s)[1] - 1]} ${parts(s)[0]}`
  const quarterLabel = (s: string) => `Q${quarterOf(s)} ${parts(s)[0]}`
  const taxLabel = (s: string) => `Tax year ${fiscalLabel(s, fs)}`
  switch (p.preset) {
    case 'allTime':
      return null
    case 'thisMonth':
      return back(1, false, (s) => `${monthLabel(s)}, same days`)
    case 'lastMonth':
      return back(1, true, monthLabel)
    case 'thisQuarter':
      return back(3, false, (s) => `${quarterLabel(s)}, same days`)
    case 'lastQuarter':
      return back(3, true, quarterLabel)
    case 'ytd':
      return back(12, false, (s) => `${parts(s)[0]} to the same date`)
    case 'thisTaxYear':
      return back(12, false, (s) => `${taxLabel(s)} to the same date`)
    case 'lastTaxYear':
      return back(12, true, taxLabel)
    default: {
      const end = addDays(p.start, -1)
      return period(p.preset, addDays(end, -(p.days - 1)), end, 'The same number of days before')
    }
  }
}
