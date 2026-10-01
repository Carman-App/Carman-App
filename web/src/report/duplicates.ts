import type { Rec } from './dataset.ts'

/**
 * Possible duplicates (SYS-15): same vehicle, same day, same kind of record,
 * amounts within 5% of each other — two members logging the same fuel stop.
 * Only ever flagged for the sender to review; nothing is merged or dropped
 * unless they choose to leave a record out, which the scope statement then
 * declares.
 */

export const DUPLICATE_TOLERANCE = 0.05

export type DuplicateGroup = { key: string; records: Rec[] }

export function findDuplicates(records: Rec[]): DuplicateGroup[] {
  const buckets = new Map<string, Rec[]>()
  for (const r of records) {
    if (r.type === 'odometer' || r.amount <= 0) continue
    const key = `${r.vehicleId}|${r.date}|${r.type}|${r.expenseCategory ?? ''}`
    const list = buckets.get(key)
    if (list) list.push(r)
    else buckets.set(key, [r])
  }
  const groups: DuplicateGroup[] = []
  for (const [key, list] of buckets) {
    if (list.length < 2) continue
    const sorted = [...list].sort((a, b) => a.amount - b.amount || a.id.localeCompare(b.id))
    let cluster: Rec[] = [sorted[0]!]
    const flush = () => {
      if (cluster.length > 1) groups.push({ key: `${key}|${cluster[0]!.id}`, records: cluster })
    }
    for (let i = 1; i < sorted.length; i += 1) {
      const prev = cluster[cluster.length - 1]!
      const cur = sorted[i]!
      if (cur.amount - prev.amount <= DUPLICATE_TOLERANCE * cur.amount) cluster.push(cur)
      else {
        flush()
        cluster = [cur]
      }
    }
    flush()
  }
  return groups.sort((a, b) => (a.records[0]!.date < b.records[0]!.date ? 1 : -1))
}
