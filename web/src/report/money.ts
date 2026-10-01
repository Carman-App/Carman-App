/**
 * Money is handled in integer minor units (cents) end to end. The API sends
 * Decimal(12,2) columns as fixed two-decimal strings, so parsing is exact,
 * and every subtotal and total is a plain integer sum — the parts always add
 * up to the whole (SYS-16).
 */

/** "1234.50" → 123450. Exact for the API's fixed-decimal strings. */
export function toMinor(value: string | number | null | undefined): number {
  if (value == null || value === '') return 0
  if (typeof value === 'number') return Number.isFinite(value) ? Math.round(value * 100) : 0
  const match = /^(-)?(\d+)(?:\.(\d{1,2}))?$/.exec(value.trim())
  if (!match) {
    const n = Number(value)
    return Number.isFinite(n) ? Math.round(n * 100) : 0
  }
  const minor = Number(match[2]) * 100 + Number((match[3] ?? '').padEnd(2, '0'))
  return match[1] ? -minor : minor
}

/** 123450 → "1234.50" — unformatted, for CSV (RECIP-03). */
export function minorToDecimalString(minor: number): string {
  const sign = minor < 0 ? '-' : ''
  const abs = Math.abs(minor)
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`
}

export function sum(values: Iterable<number>): number {
  let total = 0
  for (const v of values) total += v
  return total
}

/**
 * Whole-percent shares of a total. Each share is rounded on its own and
 * never nudged to make the column reach 100 — when it doesn't, `roundedSum`
 * lets the document say so instead (SYS-16).
 */
export function shares(parts: number[], whole: number): { pct: number[]; roundedSum: number } {
  if (whole <= 0) return { pct: parts.map(() => 0), roundedSum: 0 }
  const pct = parts.map((p) => Math.round((p / whole) * 100))
  return { pct, roundedSum: pct.reduce((a, b) => a + b, 0) }
}
