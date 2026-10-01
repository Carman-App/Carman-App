import { makeFmt, type Fmt } from './fmt.ts'
import { fingerprint, shortRef } from './hash.ts'
import type { BarRow, Block, Omission, ReportDoc, Row, ScopeLine, Section } from './model.ts'
import { shares, sum } from './money.ts'
import { daysBetween, previousPeriod, resolvePeriod, type Period, type PeriodSpec } from './period.ts'
import { fileSafe, listText } from './text.ts'
import type { WorkDataset, WorkInvoice, WorkJob } from './workDataset.ts'
import type { BuildContext } from './expense.ts'

/**
 * The work report — the mechanic's side of the one report: what was
 * invoiced and collected, who owes, the bench, customers, approvals and
 * every job (brief §04, mechanic rows). Pure and deterministic, like the
 * expense report.
 */

export type WorkParams = {
  period: PeriodSpec
  /** Workshop member ids; empty = the whole bench. */
  mechanicIds: string[]
  /** One customer → the report becomes their statement (MECH-07). */
  customerId: string | null
  /** One vehicle → the report becomes its work record (MECH-11). */
  vehicleKey: string | null
  note: string
  contact: string
}

export const DEFAULT_WORK_PARAMS: WorkParams = {
  period: { preset: 'thisMonth' },
  mechanicIds: [],
  customerId: null,
  vehicleKey: null,
  note: '',
  contact: '',
}

/** Unanswered estimates older than this count as expired (MECH-09). */
export const ESTIMATE_EXPIRY_DAYS = 30
/** A vehicle back within this many days of an invoice counts as a return (MECH-10). */
export const RETURN_WINDOW_DAYS = 30

export const JOB_STATUS_LABEL: Record<string, string> = {
  INTAKE: 'Booked in',
  AWAITING_APPROVAL: 'Awaiting approval',
  APPROVED: 'Approved',
  IN_PROGRESS: 'In progress',
  READY_FOR_COLLECTION: 'Ready for collection',
  INVOICED: 'Invoiced',
  PARTIALLY_PAID: 'Part paid',
  PAID: 'Paid',
  DECLINED: 'Declined',
  CANCELLED: 'Cancelled',
}

export const METHOD_LABEL: Record<string, string> = {
  CASH: 'Cash',
  MOBILE_MONEY: 'Mobile money',
  BANK_TRANSFER: 'Bank transfer',
  CARD: 'Card',
  OTHER: 'Other',
}

export const invoiceRef = (id: string) => `INV-${shortRef(id)}`

const paid = (inv: WorkInvoice) => sum(inv.payments.map((p) => p.amount))

/**
 * Split an amount into parts that add back up exactly (SYS-16), in steps of
 * `unit` minor units — whole currency units when the document shows no
 * cents, so the printed parts still sum to the printed total.
 */
function splitExact(amount: number, ways: number, unit: number): number[] {
  const steps = Math.floor(amount / unit)
  const base = Math.floor(steps / ways)
  const rest = steps - base * ways
  const parts = Array.from({ length: ways }, (_, i) => (base + (i < rest ? 1 : 0)) * unit)
  parts[0]! += amount - steps * unit
  return parts
}

// ---------------------------------------------------------------------------
// Selection
// ---------------------------------------------------------------------------

export type WorkSelection = {
  period: Period
  previous: Period | null
  day: (ts: string) => string
  jobs: WorkJob[]
  jobById: Map<string, WorkJob>
  /** Jobs taken in during the period. */
  jobsInPeriod: WorkJob[]
  /** Invoices dated in the period. */
  invoicesInPeriod: WorkInvoice[]
  previousInvoices: WorkInvoice[]
  /** Every invoice of the selected jobs, any date. */
  invoices: WorkInvoice[]
}

export function selectWork(data: WorkDataset, params: WorkParams, today: string, day: (ts: string) => string): WorkSelection {
  const mechanics = new Set(params.mechanicIds)
  const jobs = data.jobs.filter(
    (j) =>
      (mechanics.size === 0 || j.mechanicIds.some((m) => mechanics.has(m))) &&
      (!params.customerId || j.customerId === params.customerId) &&
      (!params.vehicleKey || j.vehicleKey === params.vehicleKey),
  )
  const jobIds = new Set(jobs.map((j) => j.id))
  const earliest = jobs.reduce<string | null>((min, j) => {
    const d = day(j.createdAt)
    return min == null || d < min ? d : min
  }, null)
  const ctx = { today, region: data.conventions.region, earliest }
  const period = resolvePeriod(params.period, ctx)
  const previous = previousPeriod(period, ctx)
  const inRange = (ts: string, p: Period) => {
    const d = day(ts)
    return d >= p.start && d <= p.end
  }
  const invoices = data.invoices.filter((i) => jobIds.has(i.jobId)).sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1))
  return {
    period,
    previous,
    day,
    jobs,
    jobById: new Map(data.jobs.map((j) => [j.id, j])),
    jobsInPeriod: jobs.filter((j) => inRange(j.createdAt, period)).sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1)),
    invoicesInPeriod: invoices.filter((i) => inRange(i.createdAt, period)),
    previousInvoices: previous ? invoices.filter((i) => inRange(i.createdAt, previous)) : [],
    invoices,
  }
}

export type WorkBuilderInfo = { period: Period; jobs: number; invoiced: number; invoices: number }

export function workBuilderInfo(data: WorkDataset, params: WorkParams, today: string, timeZone?: string): WorkBuilderInfo {
  const fmt = makeFmt(data.conventions, { fractionDigits: 0, timeZone })
  const sel = selectWork(data, params, today, fmt.stampIso)
  return {
    period: sel.period,
    jobs: sel.jobsInPeriod.length,
    invoiced: sum(sel.invoicesInPeriod.map((i) => i.total)),
    invoices: sel.invoicesInPeriod.length,
  }
}

// ---------------------------------------------------------------------------
// The document
// ---------------------------------------------------------------------------

export function buildWorkReport(data: WorkDataset, params: WorkParams, ctx: BuildContext): ReportDoc {
  const anyCents =
    data.invoices.some((i) => i.total % 100 !== 0 || i.payments.some((p) => p.amount % 100 !== 0)) ||
    data.estimates.some((e) => e.total % 100 !== 0) ||
    data.jobs.some((j) => j.lines.some((l) => l.cost % 100 !== 0))
  const fmt = makeFmt(data.conventions, { fractionDigits: anyCents ? 2 : 0, timeZone: ctx.timeZone })
  const day = fmt.stampIso
  const sel = selectWork(data, params, ctx.today, day)
  const { period } = sel
  const today = ctx.today
  const customerById = new Map(data.customers.map((c) => [c.id, c]))
  const memberById = new Map(data.members.map((m) => [m.id, m]))
  const rangeLabel = `${fmt.dateLong(period.start)} – ${fmt.dateLong(period.end)}`
  const customer = params.customerId ? customerById.get(params.customerId) ?? null : null
  const vehicleLabel = params.vehicleKey ? data.jobs.find((j) => j.vehicleKey === params.vehicleKey)?.vehicleLabel ?? null : null

  const sections: Section[] = []
  const omitted: Omission[] = []
  const add = (s: Section) => {
    if (s.blocks.length > 0) sections.push(s)
  }

  const invoiced = sum(sel.invoicesInPeriod.map((i) => i.total))
  const received = sum(sel.invoicesInPeriod.map((i) => Math.min(paid(i), i.total)))
  const outstanding = invoiced - received
  const overdue = sum(
    sel.invoicesInPeriod
      .filter((i) => i.dueDate && day(i.dueDate) < today)
      .map((i) => Math.max(0, i.total - paid(i))),
  )
  const carCount = new Set(sel.invoicesInPeriod.map((i) => sel.jobById.get(i.jobId)?.vehicleKey)).size
  const aro = sel.invoicesInPeriod.length > 0 ? Math.round(invoiced / sel.invoicesInPeriod.length) : 0
  const prevInvoiced = sum(sel.previousInvoices.map((i) => i.total))
  const prevAro = sel.previousInvoices.length > 0 ? Math.round(prevInvoiced / sel.previousInvoices.length) : null
  const thin = sel.invoicesInPeriod.length < 3

  // -- Summary: invoiced, car count, average repair order (SHOP-02/03) --------
  {
    const blocks: Block[] = [
      { kind: 'figure', label: 'Invoiced in this period', value: fmt.moneyCode(invoiced), caption: `${fmt.count(sel.invoicesInPeriod.length, 'invoice')} · ${rangeLabel}` },
    ]
    if (sel.invoicesInPeriod.length > 0) {
      const aroChange = prevAro != null && prevAro > 0 ? Math.round(((aro - prevAro) / prevAro) * 100) : null
      blocks.push({
        kind: 'stats',
        items: [
          { label: 'Car count', value: fmt.int(carCount), caption: 'vehicles invoiced' },
          {
            label: 'Average repair order (ARO)',
            value: fmt.money(aro),
            caption: prevAro != null ? `${fmt.money(prevAro)} the period before (${aroChange != null ? fmt.signedPct(aroChange) : '—'})` : 'nothing invoiced the period before',
          },
          { label: 'Jobs taken in', value: fmt.int(sel.jobsInPeriod.length), caption: 'booked in during the period' },
        ],
      })
      blocks.push({ kind: 'note', tone: 'muted', text: 'Average repair order is invoiced value divided by the number of invoices. Read it beside car count: together they show whether a change in revenue came from traffic or from the size of each job.' })
    }
    if (sel.invoicesInPeriod.length === 0) blocks.push({ kind: 'note', tone: 'warning', text: 'Nothing was invoiced in this period.' })
    else if (thin) blocks.push({ kind: 'note', tone: 'warning', text: `Only ${fmt.count(sel.invoicesInPeriod.length, 'invoice')} in this period, so rates and averages rest on very little.` })
    add({ id: 'total', title: 'Invoiced in the period', stories: ['SHOP-02', 'SHOP-03', 'SYS-04'], blocks })
  }

  // -- Invoiced and collected (MECH-01) -------------------------------------------
  if (invoiced > 0) {
    const notOverdue = outstanding - overdue
    add({
      id: 'collected',
      title: 'Invoiced and collected',
      stories: ['MECH-01'],
      blocks: [
        {
          kind: 'stack',
          segments: [
            { label: 'Received', value: fmt.money(received), fraction: received / invoiced, fill: 'solid' },
            { label: 'Owed, not yet due', value: fmt.money(notOverdue), fraction: notOverdue / invoiced, fill: 'light' },
            { label: 'Overdue', value: fmt.money(overdue), fraction: overdue / invoiced, fill: 'hatch' },
          ],
        },
        {
          kind: 'stats',
          items: [
            { label: 'Invoiced', value: fmt.money(invoiced) },
            { label: 'Received', value: fmt.money(received) },
            { label: 'Outstanding', value: fmt.money(outstanding) },
            { label: 'Overdue', value: fmt.money(overdue), tone: overdue > 0 ? 'warning' : 'default' },
            { label: 'Collection rate', value: fmt.pct(Math.round((received / invoiced) * 100)) },
          ],
        },
        { kind: 'note', tone: 'muted', text: `Invoices dated in the period, and what has been paid against them as of ${fmt.dateLong(today)}. Billing is not earning until it is collected.` },
      ],
    })
  }

  // -- Who owes, and how long (MECH-02) — as of today, any invoice date ---------
  {
    const owing = sel.invoices
      .map((inv) => ({ inv, owed: inv.total - Math.min(paid(inv), inv.total), age: daysBetween(day(inv.createdAt), today) }))
      .filter((x) => x.owed > 0)
      .sort((a, b) => b.age - a.age || a.inv.id.localeCompare(b.inv.id))
    if (owing.length > 0) {
      const buckets = [
        { label: 'Current (0–30 days)', test: (a: number) => a <= 30 },
        { label: '31–60 days', test: (a: number) => a > 30 && a <= 60 },
        { label: '61–90 days', test: (a: number) => a > 60 && a <= 90 },
        { label: 'Over 90 days', test: (a: number) => a > 90 },
      ].map((b) => {
        const xs = owing.filter((x) => b.test(x.age))
        return { label: b.label, count: xs.length, owed: sum(xs.map((x) => x.owed)) }
      })
      const totalOwed = sum(owing.map((x) => x.owed))
      const max = Math.max(1, ...buckets.map((b) => b.owed))
      add({
        id: 'ageing',
        title: 'Who owes, and how long',
        stories: ['MECH-02'],
        blocks: [
          {
            kind: 'bars',
            rows: buckets.map((b, i) => ({
              label: b.label,
              sub: fmt.count(b.count, 'invoice'),
              value: b.count > 0 ? fmt.money(b.owed) : '—',
              fraction: b.owed / max,
              tone: i >= 2 && b.count > 0 ? 'warning' : b.count === 0 ? 'muted' : 'default',
            })),
            caption: `${fmt.moneyCode(totalOwed)} owed across ${fmt.count(owing.length, 'invoice')}, as of ${fmt.dateLong(today)} — every unpaid invoice, not only this period's. Age counts from the invoice date.`,
          },
          {
            kind: 'table',
            columns: [
              { key: 'customer', label: 'Customer', width: 2.2 },
              { key: 'ref', label: 'Invoice', width: 1.3 },
              { key: 'date', label: 'Dated', width: 1.1 },
              { key: 'age', label: 'Age', align: 'right', width: 0.9 },
              { key: 'total', label: 'Total', align: 'right', width: 1.1 },
              { key: 'owed', label: 'Owed', align: 'right', width: 1.1 },
            ],
            rows: owing.map((x) => {
              const job = sel.jobById.get(x.inv.jobId)
              const c = job ? customerById.get(job.customerId) : undefined
              return {
                cells: {
                  customer: { text: c?.name ?? 'Unknown customer', sub: c?.phone ?? undefined },
                  ref: { text: invoiceRef(x.inv.id), sub: job?.vehicleLabel },
                  date: fmt.date(day(x.inv.createdAt)),
                  age: fmt.count(x.age, 'day'),
                  total: fmt.money(x.inv.total),
                  owed: fmt.money(x.owed),
                },
                tone: x.age > 60 ? 'warning' : undefined,
              }
            }),
            footer: { cells: { customer: 'Total owed', ref: '', date: '', age: '', total: '', owed: fmt.money(totalOwed) } },
            caption: 'Oldest first, so the longest-owed are chased first.',
          },
        ],
      })
    }
  }

  omitted.push({ title: 'By type of work', reason: 'Jobs are not tagged with a type of work in Carma yet, so revenue can’t be split that way.' })

  // -- The bench (SHOP-01, SHOP-08) ----------------------------------------------
  {
    const credit = new Map<string, { jobs: Set<string>; invoiced: number; collected: number }>()
    for (const inv of sel.invoicesInPeriod) {
      const job = sel.jobById.get(inv.jobId)
      const mechanics = (job?.mechanicIds ?? []).filter((m) => memberById.has(m)).sort()
      const keys = mechanics.length > 0 ? mechanics : ['']
      const unit = fmt.fractionDigits === 0 ? 100 : 1
      const inv$ = splitExact(inv.total, keys.length, unit)
      const col$ = splitExact(Math.min(paid(inv), inv.total), keys.length, unit)
      keys.forEach((k, i) => {
        const c = credit.get(k) ?? { jobs: new Set<string>(), invoiced: 0, collected: 0 }
        c.jobs.add(inv.jobId)
        c.invoiced += inv$[i]!
        c.collected += col$[i]!
        credit.set(k, c)
      })
    }
    const named = [...credit.keys()].filter((k) => k !== '')
    if (named.length > 1 || (named.length === 1 && params.mechanicIds.length > 0)) {
      const ranked = [...credit.entries()].sort((a, b) => b[1].invoiced - a[1].invoiced || a[0].localeCompare(b[0]))
      const { pct } = shares(ranked.map(([, c]) => c.invoiced), invoiced)
      add({
        id: 'bench',
        title: 'The bench',
        stories: ['SHOP-01', 'SHOP-08'],
        blocks: [
          {
            kind: 'table',
            columns: [
              { key: 'who', label: 'Mechanic', width: 2.2 },
              { key: 'jobs', label: 'Jobs', align: 'right', width: 0.8 },
              { key: 'invoiced', label: 'Invoiced', align: 'right', width: 1.2 },
              { key: 'share', label: 'Share', align: 'right', width: 0.8 },
              { key: 'collected', label: 'Collected', align: 'right', width: 1.2 },
            ],
            rows: ranked.map(([k, c], i) => ({
              cells: {
                who: k === '' ? 'Not assigned' : (memberById.get(k)?.name ?? 'Former staff'),
                jobs: fmt.int(c.jobs.size),
                invoiced: fmt.money(c.invoiced),
                share: fmt.pct(pct[i]!),
                collected: fmt.money(c.collected),
              },
              tone: k === '' ? 'muted' : undefined,
            })),
            footer: { cells: { who: 'Whole bench', jobs: '', invoiced: fmt.money(invoiced), share: '', collected: fmt.money(received) } },
          },
          {
            kind: 'note',
            text: 'Basis for commission: work invoiced in the period, credited to the mechanics assigned to each job and split equally between them; "collected" counts only what customers have paid. A job worked by two mechanics counts in both their job counts.',
          },
        ],
      })
    }
  }

  // -- By customer (SHOP-06, MECH-06) --------------------------------------------
  if (!customer && invoiced > 0) {
    const byCustomer = new Map<string, number>()
    for (const inv of sel.invoicesInPeriod) {
      const cid = sel.jobById.get(inv.jobId)?.customerId ?? ''
      byCustomer.set(cid, (byCustomer.get(cid) ?? 0) + inv.total)
    }
    const ranked = [...byCustomer.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    const shown = ranked.slice(0, 8)
    const rest = ranked.slice(8)
    const { pct } = shares(shown.map(([, v]) => v), invoiced)
    const max = Math.max(1, ...shown.map(([, v]) => v))
    const rows: BarRow[] = shown.map(([cid, v], i) => ({
      label: customerById.get(cid)?.name ?? 'Unknown customer',
      value: fmt.money(v),
      share: fmt.pct(pct[i]!),
      fraction: v / max,
    }))
    if (rest.length > 0) {
      const v = sum(rest.map(([, x]) => x))
      rows.push({ label: fmt.count(rest.length, 'other customer'), value: fmt.money(v), share: fmt.pct(Math.round((v / invoiced) * 100)), fraction: v / max, tone: 'muted' })
    }
    const top1 = ranked[0] ? Math.round((ranked[0][1] / invoiced) * 100) : 0
    const top3 = Math.round((sum(ranked.slice(0, 3).map(([, v]) => v)) / invoiced) * 100)

    // New and returning (MECH-06): first job ever before the period → returning.
    const firstJob = new Map<string, string>()
    const lastJob = new Map<string, string>()
    for (const j of data.jobs) {
      const d = day(j.createdAt)
      if (!firstJob.has(j.customerId) || d < firstJob.get(j.customerId)!) firstJob.set(j.customerId, d)
      if (!lastJob.has(j.customerId) || d > lastJob.get(j.customerId)!) lastJob.set(j.customerId, d)
    }
    let newCount = 0
    let newValue = 0
    let returningCount = 0
    let returningValue = 0
    for (const [cid, v] of byCustomer) {
      if ((firstJob.get(cid) ?? period.start) < period.start) {
        returningCount += 1
        returningValue += v
      } else {
        newCount += 1
        newValue += v
      }
    }
    const lapsed = [...lastJob.entries()].filter(([, d]) => daysBetween(d, period.end) > 365).length
    add({
      id: 'customers',
      title: 'By customer',
      stories: ['SHOP-06', 'MECH-06'],
      blocks: [
        { kind: 'bars', rows, caption: `Largest customer: ${top1}% of invoiced value; top three: ${top3}%.` },
        {
          kind: 'stats',
          items: [
            { label: 'Returning customers', value: fmt.int(returningCount), caption: fmt.moneyCode(returningValue) },
            { label: 'New customers', value: fmt.int(newCount), caption: fmt.moneyCode(newValue) },
            { label: 'Not seen in 12 months', value: fmt.int(lapsed), caption: 'customers' },
          ],
        },
        { kind: 'note', tone: 'muted', text: 'A customer is returning if they brought a vehicle in before this period.' },
      ],
    })
  }

  // -- Approved and declined (SHOP-04, MECH-09) -----------------------------------
  {
    const jobIds = new Set(sel.jobs.map((j) => j.id))
    const estimates = data.estimates.filter((e) => jobIds.has(e.jobId) && day(e.createdAt) >= period.start && day(e.createdAt) <= period.end)
    if (estimates.length > 0) {
      const state = (e: (typeof estimates)[number]) =>
        e.status === 'PENDING' ? (daysBetween(day(e.createdAt), today) > ESTIMATE_EXPIRY_DAYS ? 'expired' : 'open') : e.status === 'APPROVED' ? 'approved' : 'declined'
      const value = (s: string) => sum(estimates.filter((e) => state(e) === s).map((e) => e.total))
      const approved = value('approved')
      const declined = value('declined')
      const expired = value('expired')
      const decided = approved + declined + expired
      const open = estimates.filter((e) => state(e) === 'open').length
      const lost = estimates
        .filter((e) => state(e) === 'declined' || state(e) === 'expired')
        .flatMap((e) =>
          e.items.map((item) => ({ e, item, job: sel.jobById.get(e.jobId) })),
        )
        .sort((a, b) => b.item.cost - a.item.cost || a.e.id.localeCompare(b.e.id))
      const blocks: Block[] = [
        {
          kind: 'stats',
          items: [
            { label: 'Estimated', value: fmt.money(sum(estimates.map((e) => e.total))), caption: fmt.count(estimates.length, 'estimate') },
            { label: 'Approved', value: fmt.money(approved) },
            { label: 'Approval rate', value: decided > 0 ? fmt.pct(Math.round((approved / decided) * 100)) : '—', caption: 'by value, decided estimates' },
            { label: 'Declined or expired', value: fmt.money(declined + expired), tone: declined + expired > 0 ? 'warning' : 'default' },
          ],
        },
      ]
      if (open > 0) blocks.push({ kind: 'note', tone: 'muted', text: `${fmt.count(open, 'estimate')} still awaiting an answer ${open === 1 ? 'is' : 'are'} not counted in the rate. Estimates unanswered after ${ESTIMATE_EXPIRY_DAYS} days count as expired.` })
      if (lost.length > 0) {
        blocks.push({
          kind: 'table',
          columns: [
            { key: 'customer', label: 'Customer', width: 1.8 },
            { key: 'vehicle', label: 'Vehicle', width: 1.8 },
            { key: 'item', label: 'Work quoted', width: 2.2 },
            { key: 'status', label: 'Outcome', width: 1.1 },
            { key: 'value', label: 'Value', align: 'right', width: 1 },
          ],
          rows: lost.map(({ e, item, job }) => ({
            cells: {
              customer: job ? (customerById.get(job.customerId)?.name ?? '—') : '—',
              vehicle: job?.vehicleLabel ?? '—',
              item: { text: item.description, sub: `Quoted ${fmt.date(day(e.createdAt))}` },
              status: state(e) === 'expired' ? 'Expired' : 'Declined',
              value: fmt.money(item.cost),
            },
          })),
          caption: 'Work quoted but not taken up — a list to follow up, largest first.',
        })
      }
      add({ id: 'estimates', title: 'Approved and declined', stories: ['SHOP-04', 'MECH-09'], blocks })
    }
  }

  // -- Every job (MECH-05, MECH-10) -----------------------------------------------
  if (sel.jobsInPeriod.length > 0) add(jobsSection(data, sel, fmt, memberById, customerById))

  // -- Takings by method, for a day or a week (MECH-12) ---------------------------
  if (period.days <= 7) {
    const payments = sel.invoices.flatMap((inv) => inv.payments.filter((p) => day(p.paidAt) >= period.start && day(p.paidAt) <= period.end).map((p) => ({ p, inv })))
    const byMethod = new Map<string, { count: number; amount: number; invoices: Set<string> }>()
    for (const { p, inv } of payments) {
      const m = byMethod.get(p.method) ?? { count: 0, amount: 0, invoices: new Set<string>() }
      m.count += 1
      m.amount += p.amount
      m.invoices.add(inv.id)
      byMethod.set(p.method, m)
    }
    const taken = sum(payments.map(({ p }) => p.amount))
    const overpaid = sel.invoices.filter((inv) => paid(inv) > inv.total && inv.payments.some((p) => day(p.paidAt) >= period.start && day(p.paidAt) <= period.end))
    const blocks: Block[] = []
    if (payments.length === 0) blocks.push({ kind: 'note', tone: 'muted', text: 'No payments were recorded in this period.' })
    else {
      blocks.push({
        kind: 'table',
        columns: [
          { key: 'method', label: 'Paid by', width: 2 },
          { key: 'count', label: 'Payments', align: 'right', width: 1 },
          { key: 'invoices', label: 'Invoices settled', align: 'right', width: 1.2 },
          { key: 'amount', label: 'Amount', align: 'right', width: 1.2 },
        ],
        rows: [...byMethod.entries()]
          .sort((a, b) => b[1].amount - a[1].amount)
          .map(([method, m]) => ({ cells: { method: METHOD_LABEL[method] ?? method, count: fmt.int(m.count), invoices: fmt.int(m.invoices.size), amount: fmt.money(m.amount) } })),
        footer: { cells: { method: 'Total taken', count: fmt.int(payments.length), invoices: '', amount: fmt.money(taken) } },
        caption: 'Count the till against these totals, one method at a time.',
      })
      blocks.push(
        overpaid.length > 0
          ? { kind: 'list', items: overpaid.map((inv) => `${invoiceRef(inv.id)} has ${fmt.moneyCode(paid(inv) - inv.total)} more paid than invoiced — unmatched.`) }
          : { kind: 'note', tone: 'muted', text: 'Every payment matches an invoice; nothing is unmatched.' },
      )
    }
    add({ id: 'takings', title: 'Takings by method', stories: ['MECH-12'], blocks })
  }

  // -- Statement for one customer (MECH-07) ------------------------------------------
  if (customer) add(statementSection(sel, fmt, day))

  // -- Work record for one vehicle (MECH-11) -------------------------------------------
  if (params.vehicleKey && vehicleLabel) {
    const jobs = sel.jobsInPeriod
    add({
      id: 'work-record',
      title: 'Work record',
      stories: ['MECH-11'],
      blocks: jobs.flatMap<Block>((j) => [
        {
          kind: 'table',
          columns: [
            { key: 'what', label: `${fmt.dateLong(day(j.createdAt))} — ${j.fault}`, width: 4 },
            { key: 'kind', label: 'Type', width: 1 },
            { key: 'cost', label: 'Amount', align: 'right', width: 1.1 },
          ],
          rows: j.lines.map((l) => ({ cells: { what: l.description, kind: l.kind.charAt(0) + l.kind.slice(1).toLowerCase(), cost: fmt.money(l.cost) } })),
          footer: { cells: { what: JOB_STATUS_LABEL[j.status] ?? j.status, kind: '', cost: fmt.money(sum(j.lines.map((l) => l.cost))) } },
        },
      ]),
    })
    omitted.push({ title: 'Odometer and next service due', reason: 'Jobs don’t record an odometer reading or the next service, so the work record can’t show them.' })
  }

  // -- Scope -----------------------------------------------------------------------------
  const scope: ScopeLine[] = [{ label: 'Workshop', value: data.workshop.name }, { label: 'Period', value: `${period.label} — ${rangeLabel}` }]
  if (params.mechanicIds.length > 0) {
    const names = params.mechanicIds.map((id) => memberById.get(id)?.name ?? 'former staff')
    scope.push({ label: 'Mechanics', value: `Only jobs worked by ${listText(names)}. Other mechanics' jobs are left out` })
  }
  if (customer) scope.push({ label: 'Customer', value: `${customer.name}${customer.phone ? `, ${customer.phone}` : ''} — a statement of their account only` })
  if (vehicleLabel) scope.push({ label: 'Vehicle', value: `${vehicleLabel} — work on this vehicle only` })
  scope.push({ label: 'Covers', value: 'Jobs, estimates, invoices and payments recorded in Carma by this workshop. Payments taken outside Carma are not included' })

  const notes = [`Amounts are in ${fmt.currencyName} (${fmt.currency}) exactly as recorded; every total is the sum of its lines. Shares are rounded to whole per cent.`]
  const identity = JSON.stringify({
    kind: 'work',
    workshop: data.workshop.id,
    start: period.start,
    end: period.end,
    mechanics: [...params.mechanicIds].sort(),
    customer: params.customerId,
    vehicle: params.vehicleKey,
  })
  const print = fingerprint(JSON.stringify({ scope, sections, omitted, note: params.note, contact: params.contact }))
  const earlier = (ctx.earlierVersions ?? []).find((v) => v.fingerprint !== print)
  if (earlier) notes.push(`An earlier version of this report, for the same scope and period, was generated on ${fmt.stamp(earlier.generatedAt)}. Records have changed since, so its figures differ from these.`)

  const highlightMax = Math.max(1, received, outstanding - overdue, overdue)
  const title = customer ? 'Customer statement' : vehicleLabel ? 'Work record' : 'Work report'
  return {
    kind: 'work',
    version: 1,
    title,
    subject: customer ? customer.name : vehicleLabel ?? data.workshop.name,
    subjectDetail: customer || vehicleLabel ? data.workshop.name : undefined,
    periodLabel: period.label,
    periodRange: rangeLabel,
    scope,
    note: params.note.trim() ? { from: data.account.name, text: params.note.trim() } : undefined,
    contact: { name: `${data.account.name}, ${data.workshop.name}`, detail: params.contact.trim() || undefined },
    generated: { atLabel: fmt.stamp(ctx.generatedAt), by: data.account.name, dataAsOfLabel: fmt.stamp(data.snapshotAt) },
    headline: { label: 'Invoiced', value: fmt.moneyCode(invoiced), caption: `${fmt.count(sel.invoicesInPeriod.length, 'invoice')} · ${period.label}` },
    highlights:
      invoiced > 0
        ? [
            { label: 'Received', value: fmt.money(received), fraction: received / highlightMax },
            { label: 'Owed, not yet due', value: fmt.money(outstanding - overdue), fraction: (outstanding - overdue) / highlightMax },
            { label: 'Overdue', value: fmt.money(overdue), fraction: overdue / highlightMax },
          ]
        : [],
    sections,
    omitted,
    notes,
    showContents: sections.length >= 7 || sel.jobsInPeriod.length > 40,
    filename: fileSafe(`Carma ${title.toLowerCase()} - ${customer?.name ?? vehicleLabel ?? data.workshop.name} - ${period.start} to ${period.end}.pdf`),
    fingerprint: print,
    identity,
    recordCount: sel.jobsInPeriod.length,
  }
}

function jobsSection(
  data: WorkDataset,
  sel: WorkSelection,
  fmt: Fmt,
  memberById: Map<string, { name: string }>,
  customerById: Map<string, { name: string }>,
): Section {
  const day = sel.day
  const firstInvoice = new Map<string, WorkInvoice>()
  for (const inv of sel.invoices) if (!firstInvoice.has(inv.jobId)) firstInvoice.set(inv.jobId, inv)

  // Returns (MECH-10): the same vehicle back within the window of an earlier invoice.
  const invoicesByVehicle = new Map<string, WorkInvoice[]>()
  for (const inv of data.invoices) {
    const key = sel.jobById.get(inv.jobId)?.vehicleKey
    if (!key) continue
    invoicesByVehicle.set(key, [...(invoicesByVehicle.get(key) ?? []), inv])
  }
  const returnOf = (j: WorkJob) => {
    const prior = (invoicesByVehicle.get(j.vehicleKey) ?? []).filter((inv) => inv.jobId !== j.id && inv.createdAt < j.createdAt)
    const last = prior.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))[0]
    if (!last) return null
    const gap = daysBetween(day(last.createdAt), day(j.createdAt))
    return gap <= RETURN_WINDOW_DAYS ? { gap, inv: last } : null
  }

  const turnaround = new Map<string, number>()
  for (const j of sel.jobsInPeriod) {
    const inv = firstInvoice.get(j.id)
    if (inv) turnaround.set(j.id, (Date.parse(inv.createdAt) - Date.parse(j.createdAt)) / 86_400_000)
  }
  const tvals = [...turnaround.values()]
  const avg = tvals.length > 0 ? sum(tvals) / tvals.length : null
  const slowest = [...turnaround.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3)
  const returns = sel.jobsInPeriod.map((j) => [j.id, returnOf(j)] as const).filter(([, r]) => r != null)

  const rows: Row[] = sel.jobsInPeriod.map((j, i) => {
    const inv = firstInvoice.get(j.id)
    const t = turnaround.get(j.id)
    const ret = returnOf(j)
    const mechanics = j.mechanicIds.map((m) => memberById.get(m)?.name ?? 'Former staff')
    return {
      cells: {
        n: String(i + 1),
        in: fmt.date(day(j.createdAt)),
        customer: customerById.get(j.customerId)?.name ?? '—',
        job: { text: j.fault, sub: j.vehicleLabel },
        mechanic: mechanics.join(', ') || '—',
        status: JOB_STATUS_LABEL[j.status] ?? j.status,
        invoiced: inv ? fmt.money(inv.total) : '—',
        paid: inv ? fmt.money(Math.min(paid(inv), inv.total)) : '—',
        days: t != null ? fmt.dec(t, 1) : '—',
      },
      marks: ret ? [`Back ${fmt.count(ret.gap, 'day')} after ${invoiceRef(ret.inv.id)} on ${fmt.dateLong(day(ret.inv.createdAt))}`] : [],
    }
  })
  const jobInvoices = sel.jobsInPeriod.map((j) => firstInvoice.get(j.id)).filter((x): x is WorkInvoice => !!x)
  const blocks: Block[] = []
  if (avg != null) {
    blocks.push({
      kind: 'stats',
      items: [
        { label: 'Average turnaround', value: `${fmt.dec(avg, 1)} days`, caption: 'drop-off to invoice' },
        { label: 'Returns', value: fmt.int(returns.length), caption: `${fmt.pct(Math.round((returns.length / sel.jobsInPeriod.length) * 100))} of jobs` },
      ],
    })
    blocks.push({
      kind: 'list',
      items: slowest.map(([id, t]) => {
        const j = sel.jobById.get(id)!
        return `Slow: ${j.fault} — ${j.vehicleLabel}, ${fmt.dec(t, 1)} days (in ${fmt.dateLong(day(j.createdAt))}).`
      }),
    })
  }
  blocks.push({
    kind: 'table',
    columns: [
      { key: 'n', label: '#', align: 'right', width: 0.55 },
      { key: 'in', label: 'In', width: 1.3 },
      { key: 'customer', label: 'Customer', width: 1.6 },
      { key: 'job', label: 'Job', width: 2 },
      { key: 'mechanic', label: 'Mechanic', width: 1.3 },
      { key: 'status', label: 'Status', width: 1.1 },
      { key: 'invoiced', label: 'Invoiced', align: 'right', width: 1 },
      { key: 'paid', label: 'Paid', align: 'right', width: 1 },
      { key: 'days', label: 'Days', align: 'right', width: 0.6 },
    ],
    rows,
    footer: {
      cells: {
        n: '',
        job: `${fmt.count(sel.jobsInPeriod.length, 'job')}`,
        invoiced: fmt.money(sum(jobInvoices.map((i) => i.total))),
        paid: fmt.money(sum(jobInvoices.map((i) => Math.min(paid(i), i.total)))),
      },
    },
    caption: `Jobs booked in during the period, oldest first. Days is drop-off to invoice. A return is the same vehicle back within ${RETURN_WINDOW_DAYS} days of an invoice — Carma can't tell whether it was for the same fault.`,
  })
  return { id: 'jobs', title: 'Every job', stories: ['MECH-05', 'MECH-10'], blocks }
}

function statementSection(sel: WorkSelection, fmt: Fmt, day: (ts: string) => string): Section {
  const { period } = sel
  type Entry = { at: string; text: string; sub?: string; charge: number; payment: number }
  const before: Entry[] = []
  const during: Entry[] = []
  for (const inv of sel.invoices) {
    const job = sel.jobById.get(inv.jobId)
    const entry: Entry = { at: inv.createdAt, text: `Invoice ${invoiceRef(inv.id)}`, sub: job ? `${job.fault} — ${job.vehicleLabel}` : undefined, charge: inv.total, payment: 0 }
    ;(day(inv.createdAt) < period.start ? before : day(inv.createdAt) <= period.end ? during : []).push(entry)
    for (const p of inv.payments) {
      const pe: Entry = { at: p.paidAt, text: `Payment, ${(METHOD_LABEL[p.method] ?? p.method).toLowerCase()}`, sub: `Against ${invoiceRef(inv.id)}`, charge: 0, payment: p.amount }
      ;(day(p.paidAt) < period.start ? before : day(p.paidAt) <= period.end ? during : []).push(pe)
    }
  }
  during.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0))
  const opening = sum(before.map((e) => e.charge - e.payment))
  let balance = opening
  const rows: Row[] = during.map((e) => {
    balance += e.charge - e.payment
    return {
      cells: {
        date: fmt.date(day(e.at)),
        what: { text: e.text, sub: e.sub },
        charge: e.charge ? fmt.money(e.charge) : '',
        payment: e.payment ? fmt.money(e.payment) : '',
        balance: fmt.money(balance),
      },
    }
  })
  return {
    id: 'statement',
    title: 'Statement',
    stories: ['MECH-07'],
    blocks: [
      {
        kind: 'table',
        columns: [
          { key: 'date', label: 'Date', width: 1 },
          { key: 'what', label: 'Entry', width: 3 },
          { key: 'charge', label: 'Invoiced', align: 'right', width: 1.1 },
          { key: 'payment', label: 'Paid', align: 'right', width: 1.1 },
          { key: 'balance', label: 'Balance', align: 'right', width: 1.1 },
        ],
        rows: [{ cells: { date: fmt.date(period.start), what: 'Opening balance', charge: '', payment: '', balance: fmt.money(opening) }, tone: 'muted' }, ...rows],
        footer: { cells: { date: fmt.date(period.end), what: 'Closing balance', charge: '', payment: '', balance: fmt.money(balance) } },
        caption: 'All jobs, invoices and payments for this customer in the period. A positive balance is owed to the workshop.',
      },
    ],
  }
}
