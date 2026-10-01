/**
 * Formatting for one document, following the account's region the way the
 * rest of Carma does (SYS-11): number grouping from the region's locale,
 * the configured numeric date format, and currency and distance exactly as
 * recorded — never converted (RECIP-08).
 */

export type Conventions = {
  region: string
  countryName: string | null
  /** ISO currency code, e.g. "KES". */
  currency: string
  /** Distances are stored in kilometres; this is the unit the region reads in. */
  distanceUnit: 'km' | 'mi'
  volumeUnit: 'L' | 'gal'
  /** Numeric date pattern from the Country config, e.g. "DD/MM/YYYY". */
  dateFormat: string
}

export type Fmt = {
  locale: string
  currency: string
  fractionDigits: 0 | 2
  /** Amount in minor units → "12,345" (no currency code). */
  money(minor: number): string
  /** Amount in minor units → "KES 12,345". */
  moneyCode(minor: number): string
  /** Signed change → "+12,345" / "−12,345". */
  signedMoney(minor: number): string
  /** A per-unit rate (already in major units) → "14.25". */
  rate(major: number): string
  int(n: number): string
  dec(n: number, digits: number): string
  km(n: number): string
  pct(n: number): string
  signedPct(n: number): string
  /** "1 record", "1,204 records" — counts grouped the region's way. */
  count(n: number, singular: string, pluralForm?: string): string
  /** "YYYY-MM-DD" → the region's numeric pattern, e.g. "07/08/2025". */
  date(iso: string): string
  /** "YYYY-MM-DD" → "7 Aug 2025" (or "Aug 7, 2025" where that's the convention). */
  dateLong(iso: string): string
  /** "YYYY-MM-DD" → "August 2025". */
  monthYear(iso: string): string
  /** ISO timestamp → calendar date in the reader's time zone, "1 Oct 2026". */
  stampDate(ts: string): string
  /** ISO timestamp → "1 Oct 2026, 14:20" in the reader's time zone. */
  stamp(ts: string): string
  /** ISO timestamp → "YYYY-MM-DD" in the reader's time zone. */
  stampIso(ts: string): string
  currencyName: string
}

function pickLocale(region: string): string {
  const candidate = `en-${region.toUpperCase()}`
  try {
    return Intl.NumberFormat.supportedLocalesOf([candidate]).length > 0 ? candidate : 'en-GB'
  } catch {
    return 'en-GB'
  }
}

function utcDate(iso: string): Date {
  return new Date(`${iso.slice(0, 10)}T00:00:00Z`)
}

export function makeFmt(conv: Conventions, opts: { fractionDigits: 0 | 2; timeZone?: string }): Fmt {
  const locale = pickLocale(conv.region)
  const d = opts.fractionDigits
  const timeZone = opts.timeZone
  const moneyNf = new Intl.NumberFormat(locale, { minimumFractionDigits: d, maximumFractionDigits: d })
  const intNf = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 })
  const rateNf = new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const longDate = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
  const monthYear = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' })
  const stampDate = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric', timeZone })
  const stamp = new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone,
  })
  const isoParts = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone })

  let currencyName = conv.currency
  try {
    currencyName = new Intl.DisplayNames(['en'], { type: 'currency' }).of(conv.currency) ?? conv.currency
  } catch {
    // unknown code — fall back to the code itself
  }

  const money = (minor: number) => {
    const s = moneyNf.format(Math.abs(minor) / 100)
    return minor < 0 ? `−${s}` : s
  }

  return {
    locale,
    currency: conv.currency,
    fractionDigits: d,
    currencyName,
    money,
    moneyCode: (minor) => `${conv.currency} ${money(minor)}`,
    signedMoney: (minor) => (minor > 0 ? `+${money(minor)}` : minor < 0 ? money(minor) : money(0)),
    rate: (major) => rateNf.format(major),
    int: (n) => (n < 0 ? `−${intNf.format(Math.abs(n))}` : intNf.format(n)),
    dec: (n, digits) => new Intl.NumberFormat(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(n),
    km: (n) => `${intNf.format(n)} km`,
    pct: (n) => `${n}%`,
    signedPct: (n) => (n > 0 ? `+${n}%` : n < 0 ? `−${Math.abs(n)}%` : '0%'),
    count: (n, singular, pluralForm) => `${intNf.format(n)} ${n === 1 ? singular : (pluralForm ?? `${singular}s`)}`,
    date: (iso) => {
      const [y = '', m = '', day = ''] = iso.slice(0, 10).split('-')
      return conv.dateFormat.replace('YYYY', y).replace('MM', m).replace('DD', day)
    },
    dateLong: (iso) => longDate.format(utcDate(iso)),
    monthYear: (iso) => monthYear.format(utcDate(iso)),
    stampDate: (ts) => stampDate.format(new Date(ts)),
    stamp: (ts) => stamp.format(new Date(ts)),
    stampIso: (ts) => isoParts.format(new Date(ts)),
  }
}
