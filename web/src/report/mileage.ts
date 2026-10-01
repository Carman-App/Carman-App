import { vehicleFull, vehicleShort, type OwnerDataset, type RecordType, type Vehicle } from './dataset.ts'
import type { BuildContext, ExpenseParams, ExpenseSelection } from './expense.ts'
import { makeFmt, type Fmt } from './fmt.ts'
import { fingerprint } from './hash.ts'
import { daysBetween } from './period.ts'
import type { Block, ReportDoc, Row, ScopeLine, Section } from './model.ts'
import { toMinor } from './money.ts'
import { mileageInPeriod, sourcedReadings, type Mileage, type SourcedReading } from './odometer.ts'
import { fileSafe } from './text.ts'

/**
 * The mileage record (OWN-13): the same report with one content choice —
 * distance only. An employer reimbursing mileage needs the opening and
 * closing odometer and the distance between them, not the household's
 * spending ("It must not expose more than the task needs"), and expense
 * systems want it on one page.
 */

/**
 * Room on the one page for the readings table, and what else on the page
 * eats into it — in PDF points, measured against the renderer (web/README.md
 * says how to re-measure). Kept on the safe side: when the full list might
 * not fit, the opening and closing readings stand and the rest go to the CSV.
 */
export const ONE_PAGE = {
  /**
   * Height left for table rows with no note, no rate and a one-line title,
   * less room always kept for the "earlier version" line. Always kept, so
   * whether readings are listed never depends on history (SYS-05).
   */
  rows: 156,
  row: 21,
  /** Each extra line under a row (an entry date, "former member"). */
  rowLine: 10,
  rate: 28,
  noteBase: 44,
  noteLine: 15,
  titleLine: 31,
}

/** Whether every reading can be listed and the record still fit on one page. */
export function readingsFit(rowSubs: (string | undefined)[][], extras: { rate: boolean; note: string; title: string }): boolean {
  const lines = (text: string, perLine: number) => Math.max(1, Math.ceil(text.length / perLine))
  let room = ONE_PAGE.rows
  if (extras.rate) room -= ONE_PAGE.rate
  if (extras.note.trim()) room -= ONE_PAGE.noteBase + ONE_PAGE.noteLine * lines(extras.note.trim(), 85)
  room -= ONE_PAGE.titleLine * (lines(extras.title, 36) - 1)
  for (const subs of rowSubs) {
    // A row is as tall as its tallest cell.
    const extra = Math.max(0, ...subs.map((sub) => (sub ? lines(sub, 32) : 0)))
    room -= ONE_PAGE.row + ONE_PAGE.rowLine * extra
  }
  return room >= 0
}

/** What each kind of record is called when it's only the source of a reading — never its title, which can carry prices. */
const SOURCE_LABEL: Record<RecordType, string> = {
  fuel: 'Fuel fill',
  service: 'Service',
  repair: 'Repair',
  expense: 'Expense record',
  odometer: 'Odometer reading',
}

/** "30", "24.5", "1,000.50" → minor units. Null when blank, zero or not a plain amount. */
export function parseRate(text: string): number | null {
  const t = text.replace(/[,\s]/g, '')
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(t)) return null
  const minor = toMinor(t)
  return minor > 0 ? minor : null
}

export function mileageFor(data: OwnerDataset, vehicle: Vehicle, sel: ExpenseSelection): Mileage {
  return mileageInPeriod(sourcedReadings(data.records, vehicle.id), sel.period.start, sel.period.end)
}

/** Why there's no distance, in the reader's terms and with what to do about it. */
export function mileageProblem(m: Exclude<Mileage, { ok: true }>, fmt: Fmt): string {
  switch (m.problem) {
    case 'none':
      return 'There are no odometer readings for this vehicle in the period, so there is no distance to state.'
    case 'one': {
      const only = m.readings[0]!
      return `There is only one odometer reading in the period (${fmt.km(only.km)} on ${fmt.dateLong(only.date)}). A distance needs an opening and a closing reading.`
    }
    case 'backwards':
      return `The reading of ${fmt.km(m.after.km)} on ${fmt.dateLong(m.after.date)} is lower than the one before it (${fmt.km(m.before.km)} on ${fmt.dateLong(m.before.date)}), so one of them is wrong and the distance is withheld. Correct the reading in Carma and generate the record again.`
  }
}

/** A reading's own history, short enough to sit under its date (TAX-03): entered late, or edited since. */
function entryNote(r: SourcedReading['rec'], fmt: Fmt): string | undefined {
  // The year is left off when it's the reading's own.
  const day = (iso: string) => (iso.slice(0, 4) === r.date.slice(0, 4) ? fmt.dayMonth(iso) : fmt.dateLong(iso))
  const notes: string[] = []
  if (r.createdAt) {
    const entered = fmt.stampIso(r.createdAt)
    if (daysBetween(r.date, entered) >= 2) notes.push(`entered ${day(entered)}`)
  }
  if (r.editedAt) notes.push(`edited ${day(fmt.stampIso(r.editedAt))}`)
  return notes.length > 0 ? notes.join(', ') : undefined
}

export function buildMileageReport(data: OwnerDataset, params: ExpenseParams, ctx: BuildContext, sel: ExpenseSelection, vehicle: Vehicle): ReportDoc {
  const { period } = sel
  const rate = parseRate(params.ratePerKm)
  const m = mileageFor(data, vehicle, sel)
  const amount = m.ok && rate != null ? rate * m.km : null
  const fmt = makeFmt(data.conventions, { fractionDigits: rate != null && rate % 100 !== 0 ? 2 : 0, timeZone: ctx.timeZone })
  const rangeLabel = `${fmt.dateLong(period.start)} – ${fmt.dateLong(period.end)}`
  const sections: Section[] = []

  // -- The distance ------------------------------------------------------------
  {
    const blocks: Block[] = []
    if (m.ok) {
      blocks.push({ kind: 'figure', label: 'Distance travelled', value: fmt.km(m.km) })
      blocks.push({
        kind: 'facts',
        items: [
          { label: 'Opening odometer', value: `${fmt.km(m.first.km)} on ${fmt.dateLong(m.first.date)}` },
          { label: 'Closing odometer', value: `${fmt.km(m.last.km)} on ${fmt.dateLong(m.last.date)}` },
          ...(rate != null && amount != null ? [{ label: 'At the sender’s rate', value: `${fmt.int(m.km)} km × ${fmt.moneyCode(rate)} = ${fmt.moneyCode(amount)}` }] : []),
        ],
      })
      const partial = m.first.date > period.start || m.last.date < period.end
      blocks.push({
        kind: 'note',
        tone: 'muted',
        text: `${
          partial
            ? 'Only travel between the first and last readings in the period is counted.'
            : 'The readings fall on the first and last days of the period.'
        } Carma records the odometer, not individual trips, so business and private travel are not told apart.`,
      })
    } else {
      blocks.push({ kind: 'note', tone: 'warning', text: mileageProblem(m, fmt) })
    }
    sections.push({ id: 'distance', title: 'Distance in the period', stories: ['OWN-13'], blocks })
  }

  // -- The readings behind it (SYS-03, TAX-03) ------------------------------------
  const notes = [`Distances are in kilometres, as recorded.${rate != null ? ` Amounts are in ${fmt.currencyName} (${fmt.currency}).` : ''}`]
  if (m.readings.length > 0) {
    const all: Row[] = m.readings.map((r, i) => ({
      cells: {
        n: String(i + 1),
        date: { text: fmt.date(r.date), sub: entryNote(r.rec, fmt) },
        km: fmt.int(r.km),
        source: SOURCE_LABEL[r.rec.type],
        by: { text: r.rec.enteredByName, sub: sel.person(r.rec).former ? 'former member' : undefined },
      },
    }))
    const subs = all.map((row) => Object.values(row.cells).map((c) => (c != null && typeof c !== 'string' ? c.sub : undefined)))
    // A broken sequence is listed in full, so the wrong reading can be found.
    const listAll =
      !m.ok ||
      readingsFit(subs, { rate: rate != null, note: params.note, title: vehicleFull(vehicle) })
    const rows = listAll ? all : [all[0]!, all[all.length - 1]!]
    const blocks: Block[] = [
      {
        kind: 'table',
        columns: [
          { key: 'n', label: '#', align: 'right', width: 0.45 },
          { key: 'date', label: 'Date', width: 2.3 },
          { key: 'km', label: 'Odometer (km)', align: 'right', width: 1.3 },
          { key: 'source', label: 'Recorded with', width: 1.5 },
          { key: 'by', label: 'Entered by', width: 1.7 },
        ],
        rows,
        caption: listAll
          ? 'Every reading in the period, oldest first — fuel fills and services carry one too.'
          : `The opening and closing readings. The ${fmt.count(m.readings.length - 2, 'reading')} between them, each at or above the one before, are in the CSV export.`,
      },
    ]
    sections.push({ id: 'readings', title: 'Odometer readings', stories: ['SYS-03', 'TAX-03'], blocks })
  }

  // -- Scope: what it covers, and what it deliberately leaves out (RECIP-07/10) --
  const others = data.vehicles.length > 1
  const scope: ScopeLine[] = [
    { label: 'Vehicle', value: `${vehicleFull(vehicle)}${vehicle.year ? ` (${vehicle.year})` : ''}` },
    { label: 'Period', value: `${period.label} — ${rangeLabel}` },
    { label: 'Contents', value: `Distance only. Costs, places, who paid${others ? ' and other vehicles' : ''} are left out` },
  ]
  if (rate != null) scope.push({ label: 'Rate', value: `${fmt.moneyCode(rate)} per km — set by the sender, not by Carma` })
  scope.push({ label: 'Sent by', value: params.contact.trim() ? `${data.account.name} · ${params.contact.trim()}` : data.account.name })

  const identity = JSON.stringify({ kind: 'mileage', garage: data.garage.id, vehicle: vehicle.id, start: period.start, end: period.end, rate })
  const print = fingerprint(JSON.stringify({ scope, sections, note: params.note, contact: params.contact }))
  const earlier = (ctx.earlierVersions ?? []).find((v) => v.fingerprint !== print)
  if (earlier) {
    notes.push(`An earlier version of this record, for the same vehicle and period, was generated on ${fmt.stamp(earlier.generatedAt)}. Readings have changed since, so its figures differ from these.`)
  }

  return {
    kind: 'expense',
    version: 1,
    title: 'Mileage record',
    subject: vehicleFull(vehicle),
    periodLabel: period.label,
    periodRange: rangeLabel,
    scope,
    note: params.note.trim() ? { from: data.account.name, text: params.note.trim() } : undefined,
    contact: { name: data.account.name, detail: params.contact.trim() || undefined },
    generated: { atLabel: fmt.stamp(ctx.generatedAt), by: data.account.name, dataAsOfLabel: fmt.stamp(data.snapshotAt) },
    headline: m.ok
      ? {
          label: 'Distance',
          value: fmt.km(m.km),
          caption: rate != null && amount != null ? `${fmt.moneyCode(amount)} at ${fmt.moneyCode(rate)} per km` : `${fmt.dateLong(m.first.date)} – ${fmt.dateLong(m.last.date)}`,
        }
      : { label: 'Distance', value: 'Withheld', caption: 'The odometer readings can’t support it — see the record' },
    highlights: [],
    sections,
    omitted: [],
    notes,
    showContents: false,
    filename: fileSafe(`Carma mileage record - ${vehicleShort(vehicle)} - ${period.start} to ${period.end}.pdf`),
    fingerprint: print,
    identity,
    recordCount: m.readings.length,
    pageLimit: 1,
  }
}
