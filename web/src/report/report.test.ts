import { describe, expect, it } from 'vitest'
import { expenseCsv, workCsv } from './csv.ts'
import { normalizeGarageData } from './dataset.ts'
import { DEFAULT_EXPENSE_PARAMS, buildExpenseReport, expenseBuilderInfo, type ExpenseParams } from './expense.ts'
import { TODAY, garagePayload, workshopPayload } from './fixtures.test-util.ts'
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
