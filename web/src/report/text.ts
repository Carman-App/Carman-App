/** Small text helpers shared by the report builders. */

/** Strip characters that aren't allowed in file names on common systems (SYS-09). */
export function fileSafe(name: string): string {
  return name.replace(/[/\\:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim()
}

/**
 * Round a minor-unit amount to `digits` significant figures of its major
 * value — for projections, where exact cents would claim false precision.
 */
export function roundSignificant(minor: number, digits: number): number {
  const major = minor / 100
  if (major <= 0) return 0
  const magnitude = 10 ** (Math.floor(Math.log10(major)) - (digits - 1))
  return Math.round(major / magnitude) * magnitude * 100
}

/** Lower-cased, accent-free and single-spaced, so "Brake  Pads" finds "brake pads". */
export function foldText(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim()
}

export function listText(items: string[]): string {
  if (items.length <= 1) return items[0] ?? ''
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
}

/**
 * Remove money written into free text — the Carma app records service line
 * items as "Oil filter (part, KES 1,500)" — so a document whose sender left
 * amounts out (RECIP-10) doesn't leak them through descriptions.
 */
export function scrubAmounts(text: string, currency: string): string {
  const code = currency.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const amount = `${code}\\s?[\\d,.]*\\d`
  return text
    .replace(new RegExp(`,\\s*${amount}`, 'g'), '')
    .replace(new RegExp(amount, 'g'), '')
    .replace(/\(\s*\)/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
}
