import type { Rec } from './dataset.ts'
import type { Fmt } from './fmt.ts'
import { daysBetween } from './period.ts'

/**
 * What a line says about its own history (SHARE-05, TAX-03): the date of
 * the last edit, and the entry date beside the event date when the record
 * was written up later.
 */
export function entryMarks(r: Rec, fmt: Fmt): string[] {
  const marks: string[] = []
  if (r.editedAt) marks.push(`Edited ${fmt.stampDate(r.editedAt)}`)
  if (r.createdAt) {
    const entered = fmt.stampIso(r.createdAt)
    const lag = daysBetween(r.date, entered)
    if (lag >= 2) marks.push(`Entered ${fmt.dateLong(entered)}, ${fmt.count(lag, 'day')} after the event`)
  }
  return marks
}
