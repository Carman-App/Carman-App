import { describe, expect, it } from 'vitest'
import { expenseCsv, workCsv } from './csv.ts'
import { normalizeGarageData } from './dataset.ts'
import { DEFAULT_EXPENSE_PARAMS, buildExpenseReport, expenseBuilderInfo, type ExpenseParams } from './expense.ts'
import { readingsFit } from './mileage.ts'
import { TODAY, fuel, garagePayload, workshopPayload } from './fixtures.test-util.ts'
import type { Block, ReportDoc } from './model.ts'
import { DEFAULT_WORK_PARAMS, buildWorkReport, type WorkParams } from './work.ts'
import { normalizeWorkshopData } from './workDataset.ts'

const ctx = { today: TODAY, generatedAt: '2026-10-01T09:30:00.000Z', timeZone: 'UTC' }
const garage = normalizeGarageData(garagePayload())
const expense = (p: Partial<ExpenseParams> = {}) => buildExpenseReport(garage, { ...DEFAULT_EXPENSE_PARAMS, ...p }, ctx)
const car1 = (p: Partial<ExpenseParams> = {}) => expense({ vehicleId: 'car1', ...p })

const ids = (doc: ReportDoc) => doc.sections.map((s) => s.id)
const section = (doc: ReportDoc, id: string) => doc.sections.find((s) => s.id === id)!
const blocks = <K extends Block['kind']>(doc: ReportDoc, id: string, kind: K) =>
  section(doc, id).blocks.filter((b): b is Extract<Block, { kind: K }> => b.kind === kind)
const text = (cell: unknown) => (typeof cell === 'string' ? cell : (cell as { text: string }).text)
const amount = (s: string) => Number(s.replace(/[^\d.−-]/g, '').replace('−', '-'))

/** RFC 4180 reader for the tests: quoted fields, doubled quotes, CRLF rows. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i]!
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"'
        i += 1
      } else if (c === '"') quoted = false
      else field += c
    } else if (c === '"') quoted = true
    else if (c === ',') {
      row.push(field)
      field = ''
    } else if (c === '\r' && text[i + 1] === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
      i += 1
    } else field += c
  }
  if (field || row.length) rows.push([...row, field])
  return rows
}

describe('expense report — one vehicle', () => {
  const doc = car1()

  it('switches on the sections a single vehicle supports, and only those', () => {
    expect(ids(doc)).toEqual(['total', 'categories', 'previous', 'per-km', 'people', 'places', 'planned', 'history', 'due', 'records'])
  })

  it('leads with the total and record count (OWN-01)', () => {
    expect(doc.headline).toMatchObject({ value: 'KES 127,000', caption: '14 records' })
    expect(blocks(doc, 'total', 'figure')[0]).toMatchObject({ value: 'KES 127,000' })
  })

  it('reconciles: every record, every category and every person sum exactly to the total (SYS-03, SYS-16)', () => {
    const table = blocks(doc, 'records', 'table')[0]!
    expect(table.rows).toHaveLength(14)
    const lines = table.rows.reduce((s, r) => s + amount(text(r.cells.amount)), 0)
    expect(lines).toBe(127000)
    expect(text(table.footer!.cells.amount)).toBe('127,000')
    const cats = blocks(doc, 'categories', 'bars')[0]!.rows.filter((r) => r.value !== '—')
    expect(cats.reduce((s, r) => s + amount(r.value), 0)).toBe(127000)
    const people = blocks(doc, 'people', 'bars')[0]!.rows
    expect(people.reduce((s, r) => s + amount(r.value), 0)).toBe(127000)
  })

  it('works out cost per km from the readings, with its basis (OWN-03)', () => {
    expect(blocks(doc, 'per-km', 'figure')[0]).toMatchObject({ value: 'KES 15.88', caption: '8,000 km driven' })
    const facts = blocks(doc, 'per-km', 'facts')[0]!.items
    expect(facts.find((f) => f.label === 'Opening odometer')!.value).toBe('10,000 km on 10 Jan 2026')
    expect(facts.find((f) => f.label === 'Fuel per kilometre')!.value).toBe('KES 6.25')
  })

  it('names who entered each line and keeps former members marked (SHARE-01/07)', () => {
    const people = blocks(doc, 'people', 'bars')[0]!.rows
    expect(people.map((p) => p.label)).toEqual(['Owner One', 'Former Three', 'Member Two'])
    expect(people.find((p) => p.label === 'Former Three')!.sub).toContain('former member')
    const repairRow = blocks(doc, 'records', 'table')[0]!.rows.find((r) => text(r.cells.item) === 'Brake pads')!
    expect(repairRow.cells.by).toEqual({ text: 'Former Three', sub: 'former member' })
  })

  it('marks edits, late entry and possible duplicates on the line (SHARE-05, TAX-03, SYS-15)', () => {
    const rows = blocks(doc, 'records', 'table')[0]!.rows
    expect(rows.find((r) => text(r.cells.item) === 'Insurance')!.marks).toContain('Edited 3 Feb 2026')
    const late = rows.find((r) => r.cells.date === '25/07/2026')!
    expect(late.marks).toContain('Entered 5 Aug 2026, 11 days after the event')
    expect(rows.filter((r) => r.marks?.some((m) => m.startsWith('Possible duplicate')))).toHaveLength(2)
  })

  it('counts deleted records without totalling them (TAX-03)', () => {
    const notes = blocks(doc, 'records', 'note').map((n) => n.text)
    expect(notes.some((n) => n.includes('1 record in this period was deleted after entry') && n.includes('KES 700'))).toBe(true)
  })

  it('shows coverage gaps, adherence and the next service (OWN-09, WNTY-01/02)', () => {
    expect(blocks(doc, 'history', 'list')[0]!.items[0]).toContain('between 10 Jun 2025 (first record) and 20 Jan 2026')
    const adherence = blocks(doc, 'history', 'table')[1]!
    expect(text(adherence.rows[1]!.cells.result)).toBe('Late by 700 km and 5 days')
    expect(blocks(doc, 'history', 'note').some((n) => n.text.startsWith('Next service due at 21,200 km or by 25 Jan 2027'))).toBe(true)
  })

  it('lists expiries with the expired first and keeps the projection apart from spend (FLEET-09, OWN-07)', () => {
    const docs = blocks(doc, 'due', 'table')[0]!
    expect(docs.rows.map((r) => text(r.cells.status))).toEqual(['Expired 6 days ago', '19 days left'])
    const projection = blocks(doc, 'due', 'facts')[0]!.items[0]!
    expect(projection).toMatchObject({ label: 'Projection, next 12 months', value: 'About KES 170,000' })
  })

  it('states omissions instead of guessing (OWN-05)', () => {
    expect(doc.omitted.map((o) => o.title)).toContain('Fuel consumption')
  })

  it('is deterministic for the same inputs (SYS-05)', () => {
    expect(JSON.stringify(car1())).toBe(JSON.stringify(doc))
  })

  it('says when an earlier version had different figures (SYS-05)', () => {
    const again = buildExpenseReport(garage, { ...DEFAULT_EXPENSE_PARAMS, vehicleId: 'car1' }, { ...ctx, earlierVersions: [{ generatedAt: '2026-09-01T10:00:00.000Z', fingerprint: 'different' }] })
    expect(again.notes.some((n) => n.startsWith('An earlier version of this report'))).toBe(true)
    expect(doc.notes.some((n) => n.startsWith('An earlier version'))).toBe(false)
  })
})

describe('expense report — whole garage', () => {
  const doc = expense()

  it('adds the by-vehicle ranking and drops single-vehicle sections', () => {
    expect(ids(doc)).toContain('vehicles')
    expect(ids(doc)).not.toContain('history')
    expect(ids(doc)).not.toContain('per-km')
  })

  it('ranks vehicles by spend with one per-km rule, naming who is excluded (FLEET-02/03)', () => {
    const [ranking, matrix] = blocks(doc, 'vehicles', 'table')
    expect(ranking!.rows.map((r) => text(r.cells.vehicle))).toEqual(['Toyota Prado', 'Mazda Demio', 'Yamaha XT660Z'])
    expect(text(ranking!.rows[0]!.cells.perKm)).toBe('15.88')
    expect(text(ranking!.rows[1]!.cells.perKm)).toBe('—')
    expect(blocks(doc, 'vehicles', 'list')[0]!.items[0]).toContain('Mazda Demio · KAA 002B is left out of the per-km comparison')
    // The per-vehicle × category matrix totals to the same figure (FLEET-01).
    expect(text(matrix!.footer!.cells.total)).toBe('133,100.25')
  })

  it('shows cents throughout once any amount has them', () => {
    expect(doc.headline.value).toBe('KES 133,100.25')
  })
})

describe('expense report — filters are never silent (SYS-02, RECIP-07/10)', () => {
  it('declares a person filter and withholds per-km figures it would distort', () => {
    const doc = car1({ people: ['acct:acct-member'] })
    expect(doc.recordCount).toBe(2)
    expect(doc.scope.find((l) => l.label === 'Entered by')!.value).toBe('Only Member Two. Records entered by 2 other people are left out')
    expect(doc.omitted.find((o) => o.title === 'Cost per kilometre')!.reason).toContain('limited to some people')
  })

  it('leaves amounts out everywhere when the sender hides them, and says so', () => {
    const doc = car1({ hideAmounts: true })
    expect(doc.headline).toMatchObject({ label: 'Records', value: '14' })
    expect(ids(doc)).not.toContain('categories')
    expect(blocks(doc, 'records', 'table')[0]!.columns.map((c) => c.key)).not.toContain('amount')
    expect(doc.scope.find((l) => l.label === 'Amounts')).toBeDefined()
    expect(JSON.stringify(doc)).not.toContain('127,000')
  })

  it('scrubs prices written into service descriptions when amounts are hidden (RECIP-10)', () => {
    const doc = car1({ hideAmounts: true })
    const text = JSON.stringify(doc)
    expect(text).toContain('Engine oil (fluid); Oil filter (part); Labour (labour)')
    expect(text).not.toMatch(/KES\s?\d/)
    const csv = expenseCsv(garage, { ...DEFAULT_EXPENSE_PARAMS, vehicleId: 'car1', hideAmounts: true }, TODAY)
    expect(csv).not.toMatch(/KES\s?\d/)
    // With amounts shown, the detail is untouched.
    expect(JSON.stringify(car1())).toContain('Oil filter (part, KES 1,500)')
  })

  it('declares duplicates the sender left out', () => {
    const info = expenseBuilderInfo(garage, { ...DEFAULT_EXPENSE_PARAMS, vehicleId: 'car1' }, TODAY)
    expect(info.duplicates).toHaveLength(1)
    const doc = car1({ excludeIds: ['c1-fuel-9-dup'] })
    expect(doc.recordCount).toBe(13)
    expect(doc.scope.find((l) => l.label === 'Left out')!.value).toContain('1 possible duplicate the sender chose to leave out')
  })

  it('never calls a filtered-out category "none recorded"', () => {
    const fuelOnly = car1({ categories: ['fuel'] })
    expect(ids(fuelOnly)).not.toContain('categories')
    expect(JSON.stringify(fuelOnly)).not.toContain('None recorded')
    const two = car1({ categories: ['fuel', 'service'] })
    expect(blocks(two, 'categories', 'bars')[0]!.rows.map((r) => r.label)).toEqual(['Fuel', 'Service'])
    // Unfiltered, an empty category is a true statement about the records.
    expect(JSON.stringify(blocks(car1(), 'categories', 'bars')[0])).toContain('None recorded')
  })

  it('leaves whole-vehicle sections out of a narrowed report, and says why', () => {
    const narrowed = car1({ mentioning: 'brake pads' })
    expect(ids(narrowed)).toEqual(['total', 'records'])
    expect(narrowed.omitted.map((o) => o.title)).toEqual(['Cost per kilometre', 'Service history', 'What is due next'])
    expect(narrowed.omitted[1]!.reason).toBe('Left out because the report is narrowed to some records, and a history has to show every service.')
    // Deletions reconcile the full period's total, which a narrowed report doesn't have.
    expect(JSON.stringify(narrowed)).not.toContain('deleted after entry')
    expect(JSON.stringify(car1())).toContain('deleted after entry')
    // One person's records don't need a breakdown by person.
    expect(ids(car1({ people: ['acct:acct-member'] }))).not.toContain('people')
  })

  it('says a period is empty rather than looking cheap (SYS-04)', () => {
    const doc = car1({ period: { preset: 'thisMonth' } })
    expect(doc.recordCount).toBe(0)
    expect(blocks(doc, 'total', 'note')[0]!.text).toContain('No spending is recorded in this period')
    expect(ids(doc)).not.toContain('records')
  })
})

describe('expense CSV (FLEET-13, RECIP-03)', () => {
  it('has one row per line item with unformatted amounts summing to the document total', () => {
    const csv = expenseCsv(garage, { ...DEFAULT_EXPENSE_PARAMS, vehicleId: 'car1' }, TODAY)
    expect(csv.startsWith('\uFEFFrecord_id,date,')).toBe(true)
    const [header, ...rows] = parseCsv(csv.replace('\uFEFF', ''))
    expect(rows).toHaveLength(14)
    const amountIndex = header!.indexOf('amount')
    const total = rows.reduce((s, r) => s + Number(r[amountIndex]), 0)
    expect(total).toBe(127000)
    expect(rows.every((r) => r[header!.indexOf('currency')] === 'KES')).toBe(true)
    // Commas inside fields are quoted, so every row has the header's width.
    expect(rows.every((r) => r.length === header!.length)).toBe(true)
  })

  it('drops the amount columns when amounts are hidden', () => {
    const csv = expenseCsv(garage, { ...DEFAULT_EXPENSE_PARAMS, vehicleId: 'car1', hideAmounts: true }, TODAY)
    expect(csv.split('\r\n')[0]).not.toContain('amount')
  })
})

describe('work report', () => {
  const work = normalizeWorkshopData(workshopPayload())
  const build = (p: Partial<WorkParams> = {}) => buildWorkReport(work, { ...DEFAULT_WORK_PARAMS, period: { preset: 'lastMonth' }, ...p }, ctx)
  const doc = build()

  it('separates invoiced from collected with overdue apart (MECH-01)', () => {
    expect(doc.headline.value).toBe('KES 19,001')
    const stats = Object.fromEntries(blocks(doc, 'collected', 'stats')[0]!.items.map((i) => [i.label, i.value]))
    expect(stats).toEqual({ Invoiced: '19,001', Received: '12,001', Outstanding: '7,000', Overdue: '4,000', 'Collection rate': '63%' })
  })

  it('reports car count and average repair order (SHOP-02/03)', () => {
    const stats = blocks(doc, 'total', 'stats')[0]!.items
    expect(stats.find((s) => s.label === 'Car count')!.value).toBe('2')
    expect(stats.find((s) => s.label === 'Average repair order (ARO)')!.value).toBe('6,334')
  })

  it('ages every unpaid invoice from its date, oldest first (MECH-02)', () => {
    const [buckets] = blocks(doc, 'ageing', 'bars')
    expect(buckets!.rows.map((r) => r.value)).toEqual(['7,000', '—', '—', '3,000'])
    const table = blocks(doc, 'ageing', 'table')[0]!
    expect(table.rows.map((r) => text(r.cells.age))).toEqual(['91 days', '15 days', '2 days'])
  })

  it('splits shared jobs exactly, so the bench adds up to the total (SHOP-01/08)', () => {
    const bench = blocks(doc, 'bench', 'table')[0]!
    const invoiced = bench.rows.map((r) => amount(text(r.cells.invoiced)))
    expect(invoiced).toEqual([14000, 5001])
    expect(invoiced.reduce((a, b) => a + b, 0)).toBe(19001)
  })

  it('counts approvals by value and lists declined work to follow up (SHOP-04, MECH-09)', () => {
    const stats = Object.fromEntries(blocks(doc, 'estimates', 'stats')[0]!.items.map((i) => [i.label, i.value]))
    expect(stats['Approval rate']).toBe('67%')
    expect(blocks(doc, 'estimates', 'table')[0]!.rows[0]!.cells.status).toBe('Declined')
  })

  it('flags a vehicle back within the return window (MECH-10)', () => {
    const rows = blocks(doc, 'jobs', 'table')[0]!.rows
    expect(rows.filter((r) => r.marks?.length)).toHaveLength(1)
    expect(rows[2]!.marks![0]).toMatch(/^Back 24 days after INV-/)
  })

  it('turns into a statement with opening and closing balances for one customer (MECH-07)', () => {
    const statement = build({ customerId: 'cust1' })
    expect(statement.title).toBe('Customer statement')
    const table = blocks(statement, 'statement', 'table')[0]!
    expect(text(table.rows[0]!.cells.balance)).toBe('3,000')
    expect(text(table.footer!.cells.balance)).toBe('6,000')
  })

  it('adds takings by method for a day or a week (MECH-12)', () => {
    const week = build({ period: { preset: 'thisWeek' } })
    const table = blocks(week, 'takings', 'table')[0]!
    expect(table.rows.map((r) => [text(r.cells.method), text(r.cells.amount)])).toEqual([['Cash', '2,000']])
    expect(ids(doc)).not.toContain('takings')
  })

  it('exports one row per job', () => {
    const csv = workCsv(work, { ...DEFAULT_WORK_PARAMS, period: { preset: 'lastMonth' } }, TODAY, 'UTC')
    expect(csv.trim().split('\r\n')).toHaveLength(4)
  })
})

describe('expense report — one part or job (OWN-10)', () => {
  const doc = car1({ mentioning: '  BRAKE   pads ' })

  it('keeps only the records that mention it, and says so on the cover', () => {
    const rows = blocks(doc, 'records', 'table')[0]!.rows
    expect(rows.map((r) => text(r.cells.item))).toEqual(['Brake pads'])
    expect(doc.scope.find((l) => l.label === 'Mentioning')?.value).toMatch(/^Only records whose description or notes mention “BRAKE pads”/)
    expect(doc.filename).toContain(' - BRAKE pads - ')
  })

  it('withholds cost per kilometre, which can’t be split by item', () => {
    expect(ids(doc)).not.toContain('per-km')
    expect(doc.omitted.find((o) => o.title === 'Cost per kilometre')?.reason).toContain('mentioning “BRAKE pads”')
  })

  it('finds a line item written inside a service', () => {
    expect(car1({ mentioning: 'oil filter' }).recordCount).toBe(1)
  })

  it('says it is the filter, not the records, when nothing matches', () => {
    const none = car1({ mentioning: 'turbo' })
    expect(none.recordCount).toBe(0)
    expect(blocks(none, 'total', 'note')[0]!.text).toBe('No records in this period match the filters listed on the cover.')
  })

  it('is part of what makes two reports the same report (SYS-05)', () => {
    expect(car1({ mentioning: 'Brake pads' }).identity).toBe(doc.identity)
    expect(car1().identity).not.toBe(doc.identity)
  })

  it('narrows the CSV the same way', () => {
    const csv = parseCsv(expenseCsv(garage, { ...DEFAULT_EXPENSE_PARAMS, vehicleId: 'car1', mentioning: 'brake' }, TODAY))
    expect(csv).toHaveLength(2)
    expect(csv[1]![0]).toBe('c1-rep-1')
  })
})

describe('mileage record — distance only (OWN-13)', () => {
  const spring = { preset: 'custom' as const, start: '2026-04-01', end: '2026-06-30' }
  const doc = car1({ distanceOnly: true, period: spring })

  it('states the opening and closing readings and the distance between them', () => {
    expect(doc.title).toBe('Mileage record')
    expect(ids(doc)).toEqual(['distance', 'readings'])
    expect(doc.headline).toMatchObject({ label: 'Distance', value: '2,000 km' })
    expect(blocks(doc, 'distance', 'figure')[0]).toMatchObject({ label: 'Distance travelled', value: '2,000 km' })
    const facts = Object.fromEntries(blocks(doc, 'distance', 'facts')[0]!.items.map((f) => [f.label, f.value]))
    expect(facts['Opening odometer']).toBe('13,000 km on 10 Apr 2026')
    expect(facts['Closing odometer']).toBe('15,000 km on 10 Jun 2026')
  })

  it('says which days the readings cover, and that trips are not told apart', () => {
    expect(blocks(doc, 'distance', 'note').map((n) => n.text)).toEqual([
      'Only travel between the first and last readings in the period is counted. Carma records the odometer, not individual trips, so business and private travel are not told apart.',
    ])
    const wholeMonths = car1({ distanceOnly: true, period: { preset: 'custom', start: '2026-03-10', end: '2026-05-10' } })
    expect(blocks(wholeMonths, 'distance', 'note')[0]!.text).toMatch(/^The readings fall on the first and last days of the period\./)
  })

  it('lists the readings behind the figure, with who entered each', () => {
    const rows = blocks(doc, 'readings', 'table')[0]!.rows
    expect(rows.map((r) => [text(r.cells.km), text(r.cells.source)])).toEqual([
      ['13,000', 'Fuel fill'],
      ['14,000', 'Fuel fill'],
      ['14,400', 'Repair'],
      ['15,000', 'Fuel fill'],
    ])
    expect(rows[2]!.cells.by).toMatchObject({ text: 'Former Three', sub: 'former member' })
    // A reading entered late says so under its date (TAX-03).
    const july = car1({ distanceOnly: true, period: { preset: 'custom', start: '2026-07-01', end: '2026-07-31' } })
    expect(blocks(july, 'readings', 'table')[0]!.rows.map((r) => r.cells.date)).toEqual([
      { text: '10/07/2026', sub: undefined },
      { text: '25/07/2026', sub: 'entered 5 Aug' },
    ])
  })

  it('leaves spending out entirely, and says so (RECIP-10)', () => {
    const all = JSON.stringify(doc)
    expect(all).not.toContain('KES')
    expect(all).not.toContain('Brake pads')
    expect(all).not.toContain('Corner Garage')
    expect(doc.scope.map((l) => l.label)).toEqual(['Vehicle', 'Period', 'Contents', 'Sent by'])
    expect(doc.scope[2]!.value).toBe('Distance only. Costs, places, who paid and other vehicles are left out')
    expect(doc.pageLimit).toBe(1)
  })

  it('applies the sender’s rate and prints it as theirs', () => {
    const withRate = car1({ distanceOnly: true, period: spring, ratePerKm: ' 30 ' })
    const facts = Object.fromEntries(blocks(withRate, 'distance', 'facts')[0]!.items.map((f) => [f.label, f.value]))
    expect(facts['At the sender’s rate']).toBe('2,000 km × KES 30 = KES 60,000')
    expect(withRate.scope.find((l) => l.label === 'Rate')?.value).toBe('KES 30 per km — set by the sender, not by Carma')
    expect(withRate.headline.caption).toBe('KES 60,000 at KES 30 per km')
    expect(withRate.identity).not.toBe(doc.identity)
    // Cents in the rate show cents everywhere.
    expect(car1({ distanceOnly: true, period: spring, ratePerKm: '24.5' }).headline.caption).toBe('KES 49,000.00 at KES 24.50 per km')
    // Anything that isn't a plain amount is left off rather than guessed at.
    expect(car1({ distanceOnly: true, period: spring, ratePerKm: '30/km' }).scope.find((l) => l.label === 'Rate')).toBeUndefined()
  })

  it('withholds the distance when a reading goes backwards, and lists every reading', () => {
    const payload = garagePayload()
    payload.records.push(fuel('bad', 'car1', '2026-05-20', '100.00', 13500))
    const broken = buildExpenseReport(normalizeGarageData(payload), { ...DEFAULT_EXPENSE_PARAMS, vehicleId: 'car1', distanceOnly: true, period: spring }, ctx)
    expect(broken.headline.value).toBe('Withheld')
    expect(blocks(broken, 'distance', 'note')[0]!.text).toMatch(/^The reading of 13,500 km on 20 May 2026 is lower than the one before it \(14,400 km on 14 May 2026\)/)
    expect(blocks(broken, 'readings', 'table')[0]!.rows).toHaveLength(5)
  })

  it('needs two readings, and says so when there is one', () => {
    const september = car1({ distanceOnly: true, period: { preset: 'lastMonth' } })
    expect(blocks(september, 'distance', 'note')[0]!.text).toBe(
      'There is only one odometer reading in the period (18,000 km on 10 Sept 2026). A distance needs an opening and a closing reading.',
    )
  })

  it('folds a long run of readings to the opening and closing ones, keeping all of them in the CSV', () => {
    const payload = garagePayload()
    payload.records.push(fuel('late', 'car1', '2026-09-20', '100.00', 18300))
    const data = normalizeGarageData(payload)
    const params = { ...DEFAULT_EXPENSE_PARAMS, vehicleId: 'car1', distanceOnly: true, period: { preset: 'allTime' as const } }
    const long = buildExpenseReport(data, params, ctx)
    const table = blocks(long, 'readings', 'table')[0]!
    expect(table.rows.map((r) => text(r.cells.n))).toEqual(['1', '15'])
    expect(table.caption).toBe('The opening and closing readings. The 13 readings between them, each at or above the one before, are in the CSV export.')
    const csv = parseCsv(expenseCsv(data, params, TODAY))
    expect(csv).toHaveLength(16)
    expect(csv[0]!.slice(0, 4)).toEqual(['\ufeffreading_number', 'date', 'odometer_km', 'role'])
    expect(csv[1]!.slice(1, 4)).toEqual(['2025-06-10', '6000', 'opening'])
    expect(csv[15]!.slice(1, 4)).toEqual(['2026-09-20', '18300', 'closing'])
  })

  it('lists every reading only while the page has room for them (one page, OWN-13)', () => {
    const plain = (n: number) => Array.from({ length: n }, () => [undefined])
    const late = (n: number) => Array.from({ length: n }, () => ['entered 20 Sept, edited 29 Sept'])
    const bare = { rate: false, note: '', title: 'Toyota Prado · KAA 001A' }
    expect(readingsFit(plain(7), bare)).toBe(true)
    expect(readingsFit(plain(8), bare)).toBe(false)
    expect(readingsFit(plain(6), { ...bare, rate: true })).toBe(true)
    expect(readingsFit(plain(7), { ...bare, rate: true })).toBe(false)
    expect(readingsFit(late(5), bare)).toBe(true)
    expect(readingsFit(late(6), bare)).toBe(false)
    expect(readingsFit(late(4), { ...bare, rate: true })).toBe(true)
    expect(readingsFit(late(5), { ...bare, rate: true })).toBe(false)
    expect(readingsFit(plain(4), { ...bare, note: 'x'.repeat(100) })).toBe(false)
    expect(readingsFit(plain(5), { ...bare, title: 'Toyota Land Cruiser Prado 150 Series VX Limited · KAA 001A' })).toBe(true)
    expect(readingsFit(plain(6), { ...bare, title: 'Toyota Land Cruiser Prado 150 Series VX Limited · KAA 001A' })).toBe(false)
  })

  it('lays out the same whether or not it was generated before (SYS-05)', () => {
    const again = buildExpenseReport(garage, { ...DEFAULT_EXPENSE_PARAMS, vehicleId: 'car1', distanceOnly: true, period: spring }, { ...ctx, earlierVersions: [{ generatedAt: '2026-09-30T08:00:00.000Z', fingerprint: doc.fingerprint }] })
    expect(again.fingerprint).toBe(doc.fingerprint)
    expect(again.notes).toEqual(doc.notes)
  })

  it('needs one vehicle — for the whole garage it stays the expense report', () => {
    expect(expense({ distanceOnly: true }).title).toBe('Expense report')
  })
})
