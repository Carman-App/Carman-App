import {
  CATEGORY_LABEL,
  CATEGORY_ORDER,
  CATEGORY_SHORT,
  personIndex,
  recordDetail,
  recordTitle,
  vehicleFull,
  vehicleName,
  vehicleShort,
  type CategoryKey,
  type OwnerDataset,
  type Person,
  type Rec,
  type Vehicle,
} from './dataset.ts'
import { findDuplicates, type DuplicateGroup } from './duplicates.ts'
import { makeFmt, type Fmt } from './fmt.ts'
import { fingerprint } from './hash.ts'
import { entryMarks } from './marks.ts'
import type { BarRow, Block, Column, Omission, ReportDoc, Row, ScopeLine, Section } from './model.ts'
import { shares, sum } from './money.ts'
import { distanceInPeriod, readingsFor, spendInWindow } from './odometer.ts'
import { daysBetween, previousPeriod, resolvePeriod, type Period, type PeriodSpec } from './period.ts'
import { buildMileageReport, mileageFor } from './mileage.ts'
import type { Mileage } from './odometer.ts'
import { adherence, isService, maintenanceGaps, nextService, serviceIntervalFor, type IntervalBasis } from './service.ts'
import { fileSafe, foldText, listText, roundSignificant, scrubAmounts } from './text.ts'

/**
 * The expense report: one document whose sections switch on when the
 * records support them (brief §04). Pure and deterministic — the clock,
 * the generation stamp and any earlier versions are inputs (SYS-05).
 */

export type ExpenseParams = {
  /** null = the whole garage. */
  vehicleId: string | null
  period: PeriodSpec
  /** Person keys (see personIndex); empty = everyone. */
  people: string[]
  /** Place names; '' stands for "not recorded". Empty = everywhere. */
  places: string[]
  categories: CategoryKey[]
  /** Only records whose title, description or notes mention this — one part or job (OWN-10). '' = no filter. */
  mentioning: string
  /** Records the sender left out as duplicates (SYS-15). */
  excludeIds: string[]
  hideAmounts: boolean
  /** Distance only, for a mileage claim (OWN-13) — one vehicle. */
  distanceOnly: boolean
  /** The sender's rate per km for that claim, as typed; '' = none. */
  ratePerKm: string
  note: string
  contact: string
}

export const DEFAULT_EXPENSE_PARAMS: ExpenseParams = {
  vehicleId: null,
  period: { preset: 'ytd' },
  people: [],
  places: [],
  categories: [],
  mentioning: '',
  excludeIds: [],
  hideAmounts: false,
  distanceOnly: false,
  ratePerKm: '',
  note: '',
  contact: '',
}

export type BuildContext = {
  today: string
  generatedAt: string
  timeZone?: string
  /** Earlier generations of the same report (same identity), newest first. */
  earlierVersions?: { generatedAt: string; fingerprint: string }[]
}

// ---------------------------------------------------------------------------
// Selection — shared by the builder (live counts) and the document
// ---------------------------------------------------------------------------

export type ExpenseSelection = {
  period: Period
  previous: Period | null
  vehicles: Vehicle[]
  /** Spending records of the vehicles in scope, any date. */
  scoped: Rec[]
  /** Spending records in the period, before person/place/category filters. */
  inPeriod: Rec[]
  /** The line items: in the period, filtered, minus anything the sender left out. */
  items: Rec[]
  /** Left out by the sender as duplicates. */
  excluded: Rec[]
  /** Same filters applied to the comparison period. */
  previousItems: Rec[]
  person: (r: Rec) => Person
  filteredByPerson: boolean
  filteredByPlace: boolean
  filteredByCategory: boolean
  /** The search the records were narrowed to, as typed (trimmed); '' when none. */
  mentioning: string
  /** Any filter that leaves out some of the vehicle's records — the report then covers those records, not the vehicle. */
  narrowed: boolean
}

const byDate = (a: Rec, b: Rec) =>
  a.date !== b.date ? (a.date < b.date ? -1 : 1) : (a.createdAt ?? '') !== (b.createdAt ?? '') ? ((a.createdAt ?? '') < (b.createdAt ?? '') ? -1 : 1) : a.id < b.id ? -1 : 1

export function selectExpense(data: OwnerDataset, params: ExpenseParams, today: string): ExpenseSelection {
  const vehicles = params.vehicleId ? data.vehicles.filter((v) => v.id === params.vehicleId) : data.vehicles
  const inScopeIds = new Set(vehicles.map((v) => v.id))
  const allInScope = data.records.filter((r) => inScopeIds.has(r.vehicleId))
  const earliest = allInScope.reduce<string | null>((min, r) => (min == null || r.date < min ? r.date : min), null)
  const ctx = { today, region: data.conventions.region, earliest }
  const period = resolvePeriod(params.period, ctx)
  const previous = previousPeriod(period, ctx)
  const person = personIndex(data.members)

  const people = new Set(params.people)
  const places = new Set(params.places)
  const categories = new Set(params.categories)
  const excludeIds = new Set(params.excludeIds)
  const needle = foldText(params.mentioning)
  const passes = (r: Rec) =>
    (people.size === 0 || people.has(person(r).key)) &&
    (places.size === 0 || places.has(r.place ?? '')) &&
    (categories.size === 0 || (r.category != null && categories.has(r.category))) &&
    (needle === '' || foldText(`${recordTitle(r)} ${r.description ?? ''} ${r.notes ?? ''}`).includes(needle))

  const scoped = allInScope.filter((r) => r.type !== 'odometer').sort(byDate)
  const inPeriod = scoped.filter((r) => r.date >= period.start && r.date <= period.end)
  const filtered = inPeriod.filter(passes)
  const items = filtered.filter((r) => !excludeIds.has(r.id))
  const excluded = filtered.filter((r) => excludeIds.has(r.id))
  const previousItems = previous
    ? scoped.filter((r) => r.date >= previous.start && r.date <= previous.end && passes(r) && !excludeIds.has(r.id))
    : []

  return {
    period,
    previous,
    vehicles,
    scoped,
    inPeriod,
    items,
    excluded,
    previousItems,
    person,
    filteredByPerson: people.size > 0,
    filteredByPlace: places.size > 0,
    filteredByCategory: categories.size > 0,
    mentioning: needle === '' ? '' : params.mentioning.trim().replace(/\s+/g, ' '),
    narrowed: people.size > 0 || places.size > 0 || categories.size > 0 || needle !== '',
  }
}

/** The vehicle a mileage record is for — distance only needs exactly one. */
export function distanceVehicle(params: ExpenseParams, sel: ExpenseSelection): Vehicle | null {
  return params.distanceOnly && params.vehicleId ? (sel.vehicles[0] ?? null) : null
}

/** What the builder shows before anything is generated. */
export type ExpenseBuilderInfo = {
  period: Period
  recordCount: number
  total: number
  people: { key: string; name: string; former: boolean; count: number }[]
  places: { name: string; count: number }[]
  duplicates: DuplicateGroup[]
  /** Set when the report is a mileage record. */
  mileage: Mileage | null
}

export function expenseBuilderInfo(data: OwnerDataset, params: ExpenseParams, today: string): ExpenseBuilderInfo {
  const sel = selectExpense(data, params, today)
  const people = new Map<string, { key: string; name: string; former: boolean; count: number }>()
  for (const r of sel.inPeriod) {
    const p = sel.person(r)
    const cur = people.get(p.key) ?? { key: p.key, name: p.name, former: p.former, count: 0 }
    cur.count += 1
    people.set(p.key, cur)
  }
  const places = new Map<string, number>()
  for (const r of sel.inPeriod) places.set(r.place ?? '', (places.get(r.place ?? '') ?? 0) + 1)
  return {
    period: sel.period,
    recordCount: sel.items.length,
    total: sum(sel.items.map((r) => r.amount)),
    people: [...people.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
    places: [...places.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
    // Duplicates among what would be reported (before the sender's exclusions).
    duplicates: findDuplicates([...sel.items, ...sel.excluded]),
    mileage: (() => {
      const vehicle = distanceVehicle(params, sel)
      return vehicle ? mileageFor(data, vehicle, sel) : null
    })(),
  }
}

// ---------------------------------------------------------------------------
// The document
// ---------------------------------------------------------------------------

export function buildExpenseReport(data: OwnerDataset, params: ExpenseParams, ctx: BuildContext): ReportDoc {
  const sel = selectExpense(data, params, ctx.today)
  const mileageVehicle = distanceVehicle(params, sel)
  if (mileageVehicle) return buildMileageReport(data, params, ctx, sel, mileageVehicle)
  const { period, items } = sel
  const single = params.vehicleId ? (sel.vehicles[0] ?? null) : null
  const project = single ? [...data.projects].reverse().find((p) => p.vehicleId === single.id) ?? null : null
  const lifetime = single ? sel.scoped.filter((r) => r.date <= period.end) : []
  const projectCosts = project ? project.stages.flatMap((s) => [...s.modifications.map((m) => m.cost), ...s.parts.map((p) => p.cost)]) : []
  // One decision per document: show cents only if some amount has them.
  const anyCents = [...items, ...sel.previousItems, ...lifetime].some((r) => r.amount % 100 !== 0) || projectCosts.some((c) => c % 100 !== 0)
  const fmt = makeFmt(data.conventions, { fractionDigits: anyCents ? 2 : 0, timeZone: ctx.timeZone })
  const hide = params.hideAmounts
  const total = sum(items.map((r) => r.amount))
  const thin = items.length < 3
  const vehicleById = new Map(data.vehicles.map((v) => [v.id, v]))
  const multiVehicle = sel.vehicles.length > 1
  const rangeLabel = `${fmt.dateLong(period.start)} – ${fmt.dateLong(period.end)}`

  const sections: Section[] = []
  const omitted: Omission[] = []
  const add = (s: Section) => {
    if (s.blocks.length > 0) sections.push(s)
  }

  // -- Total for the period (OWN-01, OWN-06, SYS-04) --------------------------
  {
    const blocks: Block[] = [
      hide
        ? { kind: 'figure', label: 'Records in this report', value: fmt.int(items.length), caption: rangeLabel }
        : { kind: 'figure', label: 'Spent in this period', value: fmt.moneyCode(total), caption: `${fmt.count(items.length, 'record')} · ${rangeLabel}` },
    ]
    if (single && !hide && period.preset !== 'allTime' && lifetime.length > items.length) {
      // History is often entered for the time before a vehicle joined Carma,
      // so "lifetime" starts at whichever came first.
      const joined = single.createdAt?.slice(0, 10)
      const firstRecord = lifetime[0]!.date
      const since = joined && joined < firstRecord ? joined : firstRecord
      blocks.push({
        kind: 'facts',
        items: [{ label: 'All recorded spend to date', value: `${fmt.moneyCode(sum(lifetime.map((r) => r.amount)))} across ${fmt.count(lifetime.length, 'record')}, since ${fmt.dateLong(since)}` }],
      })
    }
    if (items.length === 0) {
      blocks.push({
        kind: 'note',
        tone: 'warning',
        text: sel.narrowed
          ? 'No records in this period match the filters listed on the cover.'
          : 'No spending is recorded in this period. That is a statement about the records, not a claim that nothing was spent.',
      })
    } else if (thin) {
      blocks.push({ kind: 'note', tone: 'warning', text: `Only ${fmt.count(items.length, 'record')} in this period, so figures that need more records (comparisons, per-kilometre costs, projections) are left out.` })
    }
    add({ id: 'total', title: 'Total for the period', stories: ['OWN-01', 'OWN-06', 'SYS-03', 'SYS-04'], blocks })
  }

  // -- By category (OWN-02) ---------------------------------------------------
  const byCategory = CATEGORY_ORDER.map((key) => {
    const recs = items.filter((r) => r.category === key)
    return { key, count: recs.length, amount: sum(recs.map((r) => r.amount)) }
  })
  const presentCategories = byCategory.filter((c) => c.count > 0)
  if (!hide && items.length > 0 && (!sel.narrowed || presentCategories.length >= 2)) {
    // "None recorded" is only true of an unfiltered report; in a narrowed one the category was filtered out.
    const ranked = [...(sel.narrowed ? presentCategories : byCategory)].sort((a, b) => b.amount - a.amount || CATEGORY_ORDER.indexOf(a.key) - CATEGORY_ORDER.indexOf(b.key))
    const { pct, roundedSum } = shares(ranked.map((c) => c.amount), total)
    const max = Math.max(1, ...ranked.map((c) => c.amount))
    const blocks: Block[] = [
      {
        kind: 'bars',
        rows: ranked.map((c, i) => ({
          label: CATEGORY_LABEL[c.key],
          sub: c.count > 0 ? fmt.count(c.count, 'record') : 'None recorded',
          value: c.count > 0 ? fmt.money(c.amount) : '—',
          share: c.count > 0 ? fmt.pct(pct[i]!) : '',
          fraction: c.amount / max,
          tone: c.count > 0 ? 'default' : 'muted',
        })),
      },
    ]
    if (roundedSum !== 100 && total > 0) blocks.push({ kind: 'note', tone: 'muted', text: `Shares are rounded to the nearest per cent, so they add up to ${roundedSum}%.` })
    add({ id: 'categories', title: 'By category', stories: ['OWN-02'], blocks })
  }

  // -- Against the previous period (OWN-04) ------------------------------------
  if (!hide && sel.previous && sel.previousItems.length > 0 && items.length > 0) {
    const prev = sel.previous
    const prevTotal = sum(sel.previousItems.map((r) => r.amount))
    const rows: Row[] = CATEGORY_ORDER.map((key) => {
      const now = sum(items.filter((r) => r.category === key).map((r) => r.amount))
      const before = sum(sel.previousItems.filter((r) => r.category === key).map((r) => r.amount))
      return { key, now, before }
    })
      .filter((c) => c.now > 0 || c.before > 0)
      .map((c) => ({ cells: { category: CATEGORY_LABEL[c.key], now: fmt.money(c.now), before: fmt.money(c.before), change: changeCell(fmt, c.now, c.before) } }))
    add({
      id: 'previous',
      title: 'Against the previous period',
      stories: ['OWN-04'],
      blocks: [
        {
          kind: 'table',
          columns: [
            { key: 'category', label: 'Category', width: 2.2 },
            { key: 'now', label: 'This period', align: 'right', width: 1.3 },
            { key: 'before', label: 'Previous', align: 'right', width: 1.3 },
            { key: 'change', label: 'Change', align: 'right', width: 1.6 },
          ],
          rows,
          footer: { cells: { category: 'Total', now: fmt.money(total), before: fmt.money(prevTotal), change: changeCell(fmt, total, prevTotal) } },
          caption: `Previous period: ${prev.label}, ${fmt.dateLong(prev.start)} – ${fmt.dateLong(prev.end)}, with the same filters.`,
        },
      ],
    })
  }

  // -- Cost per kilometre (OWN-03, OWN-13) ------------------------------------
  if (single && !hide && items.length > 0) {
    const reason = perKmBlocked(sel)
    const distance = reason ? null : distanceInPeriod(readingsFor(data.records, single.id), period.start, period.end, fmt)
    if (reason || !distance?.ok) {
      omitted.push({ title: 'Cost per kilometre', reason: `Withheld because ${reason ?? (distance && !distance.ok ? distance.reason : '')}.` })
    } else {
      const spend = spendInWindow(items, single.id, distance)
      const fuel = spendInWindow(items, single.id, distance, (r) => r.category === 'fuel')
      add({
        id: 'per-km',
        title: 'Cost per kilometre',
        stories: ['OWN-03', 'OWN-13'],
        blocks: [
          { kind: 'figure', label: 'Cost per kilometre', value: `${fmt.currency} ${fmt.rate(spend / 100 / distance.km)}`, caption: `${fmt.km(distance.km)} driven` },
          {
            kind: 'facts',
            items: [
              { label: 'Opening odometer', value: `${fmt.km(distance.first.km)} on ${fmt.dateLong(distance.first.date)}` },
              { label: 'Closing odometer', value: `${fmt.km(distance.last.km)} on ${fmt.dateLong(distance.last.date)}` },
              { label: 'Distance', value: fmt.km(distance.km) },
              { label: 'Spend between those dates', value: fmt.moneyCode(spend) },
              ...(fuel > 0 ? [{ label: 'Fuel per kilometre', value: `${fmt.currency} ${fmt.rate(fuel / 100 / distance.km)}` }] : []),
            ],
          },
          {
            kind: 'note',
            tone: 'muted',
            text: `From the ${distance.readings} odometer readings in the period. Only spend dated between the first and last reading is counted, so the cost and the distance cover the same days.`,
          },
        ],
      })
    }
    if (items.some((r) => r.type === 'fuel' && r.litres != null)) {
      omitted.push({ title: 'Fuel consumption', reason: 'Fills are not marked as full-tank in Carma, so litres per 100 km would be a guess.' })
    }
  }

  // -- By vehicle (OWN-14, FLEET-01/02/03/05) ---------------------------------
  if (multiVehicle && items.length > 0) add(byVehicleSection(data, sel, fmt, hide, total))

  // -- Who spent it (SHARE-01/02/07) ----------------------------------------------
  const groups = new Map<string, { person: Person; count: number; amount: number }>()
  for (const r of items) {
    const p = sel.person(r)
    const g = groups.get(p.key) ?? { person: p, count: 0, amount: 0 }
    g.count += 1
    g.amount += r.amount
    groups.set(p.key, g)
  }
  if (data.members.length > 1 && items.length > 1 && (groups.size > 1 || !sel.filteredByPerson)) {
    const ranked = [...groups.values()].sort((a, b) => (hide ? b.count - a.count : b.amount - a.amount) || a.person.name.localeCompare(b.person.name))
    const { pct } = shares(ranked.map((g) => g.amount), total)
    const max = Math.max(1, ...ranked.map((g) => (hide ? g.count : g.amount)))
    add({
      id: 'people',
      title: 'Who spent it',
      stories: ['SHARE-01', 'SHARE-02', 'SHARE-07'],
      blocks: [
        {
          kind: 'bars',
          rows: ranked.map((g, i) => ({
            label: g.person.name,
            sub: `${fmt.count(g.count, 'record')}${g.person.former ? ' · former member' : ''}`,
            value: hide ? fmt.int(g.count) : fmt.money(g.amount),
            share: hide ? undefined : fmt.pct(pct[i]!),
            fraction: (hide ? g.count : g.amount) / max,
          })),
        },
        { kind: 'note', tone: 'muted', text: 'Each line in Every record names who entered it. Former members keep the name their records were made under.' },
      ],
    })
  }

  // -- By workshop and vendor -----------------------------------------------------
  {
    const groups = new Map<string, { count: number; amount: number }>()
    for (const r of items) {
      const g = groups.get(r.place ?? '') ?? { count: 0, amount: 0 }
      g.count += 1
      g.amount += r.amount
      groups.set(r.place ?? '', g)
    }
    if (!hide && groups.size > 1) {
      const ranked = [...groups.entries()].sort((a, b) => b[1].amount - a[1].amount || a[0].localeCompare(b[0]))
      const shown = ranked.slice(0, 12)
      const rest = ranked.slice(12)
      const { pct } = shares(shown.map(([, g]) => g.amount), total)
      const max = Math.max(1, ...shown.map(([, g]) => g.amount))
      const rows: BarRow[] = shown.map(([place, g], i) => ({
        label: place || 'Place not recorded',
        sub: fmt.count(g.count, 'visit'),
        value: fmt.money(g.amount),
        share: fmt.pct(pct[i]!),
        fraction: g.amount / max,
        tone: place ? 'default' : 'muted',
      }))
      if (rest.length > 0) {
        const restAmount = sum(rest.map(([, g]) => g.amount))
        rows.push({
          label: `${fmt.count(rest.length, 'other place')}`,
          sub: fmt.count(sum(rest.map(([, g]) => g.count)), 'visit'),
          value: fmt.money(restAmount),
          share: fmt.pct(Math.round((restAmount / total) * 100)),
          fraction: restAmount / max,
          tone: 'muted',
        })
      }
      add({ id: 'places', title: 'By workshop and vendor', stories: [], blocks: [{ kind: 'bars', rows }] })
    }
  }

  // -- Planned against unplanned (FLEET-04) ------------------------------------
  {
    const planned = byCategory.find((c) => c.key === 'service')!.amount
    const unplanned = byCategory.find((c) => c.key === 'repairs')!.amount
    if (!hide && planned > 0 && unplanned > 0) {
      const max = Math.max(planned, unplanned)
      const ratio =
        unplanned > planned
          ? `Repairs were ${fmt.dec(unplanned / planned, 1)} times what was spent on servicing.`
          : unplanned < planned
            ? `Servicing was ${fmt.dec(planned / unplanned, 1)} times what was spent on repairs.`
            : 'Servicing and repairs cost the same.'
      add({
        id: 'planned',
        title: 'Planned against unplanned',
        stories: ['FLEET-04'],
        blocks: [
          {
            kind: 'bars',
            rows: [
              { label: 'Servicing (planned)', value: fmt.money(planned), fraction: planned / max },
              { label: 'Repairs (unplanned)', value: fmt.money(unplanned), fraction: unplanned / max },
            ],
          },
          { kind: 'note', text: ratio },
        ],
      })
    }
  }

  // -- Service history and coverage (OWN-08/09, WNTY-01/02) ---------------------
  // -- What is due next (OWN-07, FLEET-09) ------------------------------------
  // Both describe the whole vehicle or garage. A report narrowed to some records
  // leaves them out and says why, rather than mixing the two scopes (and
  // showing more than the task needs).
  {
    const history = single ? serviceSection(data, sel, single, fmt, hide, ctx.today) : null
    const due = dueSection(data, sel, fmt, hide, total, ctx.today)
    if (!sel.narrowed) {
      if (history) add(history)
      add(due)
    } else {
      const whole = single ? 'the whole vehicle' : 'the whole garage'
      if (history && history.blocks.length > 0) {
        omitted.push({ title: 'Service history', reason: `Left out because the report is narrowed to some records, and a history has to show every service.` })
      }
      if (due.blocks.length > 0) {
        omitted.push({ title: 'What is due next', reason: `Left out because the report is narrowed to some records, and it describes ${whole}.` })
      }
    }
  }

  // -- Build stages (PROJ-01..04) ----------------------------------------------
  if (single && project) {
    const { section, omissions } = buildSection(project, fmt, hide)
    add(section)
    omitted.push(...omissions)
  }

  // -- Every record (SYS-03, TAX-03, SHARE-01/04/05) -----------------------------
  if (items.length > 0) add(recordsSection(data, sel, fmt, hide, total, vehicleById, multiVehicle))

  // -- Scope statement (RECIP-07/10, SYS-02) ------------------------------------
  const scope: ScopeLine[] = []
  scope.push({ label: 'Garage', value: data.garage.location ? `${data.garage.name}, ${data.garage.location}` : data.garage.name })
  if (single) {
    scope.push({
      label: 'Vehicle',
      value: `${vehicleFull(single)}${single.year ? ` (${single.year})` : ''}${data.vehicles.length > 1 ? ` — one of ${data.vehicles.length} vehicles in the garage; the others are not included` : ''}`,
    })
  } else {
    scope.push({ label: 'Vehicles', value: `All ${fmt.count(data.vehicles.length, 'vehicle')}: ${data.vehicles.map(vehicleShort).join(', ')}` })
  }
  scope.push({ label: 'Period', value: `${period.label} — ${rangeLabel}` })
  if (sel.filteredByPerson) {
    const chosen = new Set(params.people)
    const names = [...new Map(sel.inPeriod.map((r) => [sel.person(r).key, sel.person(r).name])).entries()]
    const shown = names.filter(([k]) => chosen.has(k)).map(([, n]) => n)
    const others = names.filter(([k]) => !chosen.has(k)).length
    scope.push({
      label: 'Entered by',
      value: `Only ${listText(shown.length > 0 ? shown : ['the selected people'])}${others > 0 ? `. Records entered by ${fmt.count(others, 'other person', 'other people')} are left out` : ''}`,
    })
  } else if (data.members.length > 1) {
    scope.push({ label: 'Entered by', value: 'Everyone in the garage, current and former' })
  }
  if (sel.filteredByPlace) scope.push({ label: 'Places', value: `Only ${listText(params.places.map((p) => p || 'records with no place'))}` })
  if (sel.filteredByCategory) scope.push({ label: 'Categories', value: `Only ${listText(params.categories.map((c) => CATEGORY_LABEL[c].toLowerCase()))}` })
  if (sel.mentioning) scope.push({ label: 'Mentioning', value: `Only records whose description or notes mention “${sel.mentioning}”. Everything else in the period is left out` })
  if (sel.excluded.length > 0) {
    scope.push({
      label: 'Left out',
      value: `${fmt.count(sel.excluded.length, 'possible duplicate')} the sender chose to leave out (${listText(sel.excluded.map((r) => `${recordTitle(r).toLowerCase()} on ${fmt.dateLong(r.date)}${hide ? '' : `, ${fmt.money(r.amount)}`}`))})`,
    })
  }
  if (hide) scope.push({ label: 'Amounts', value: 'Left out by the sender. This document shows what was done and when, not what it cost' })
  scope.push({ label: 'Covers', value: 'Costs only — Carma records what vehicles cost, not what they earn. Receipts are not attached' })
  // A named sender and a route back, on the first page (RECIP-09).
  scope.push({ label: 'Sent by', value: params.contact.trim() ? `${data.account.name} · ${params.contact.trim()}` : data.account.name })

  // -- Notes stated once (RECIP-08, SYS-11, SYS-16, SYS-05) ---------------------
  const notes: string[] = [
    hide
      ? `Distances are in kilometres, as recorded.`
      : `Amounts are in ${fmt.currencyName} (${fmt.currency}) exactly as recorded — nothing is converted or rounded, and every total is the sum of its lines. Shares are rounded to whole per cent. Distances are in kilometres, as recorded.`,
  ]

  const subject = single ? vehicleFull(single) : data.garage.name
  const identity = JSON.stringify({
    kind: 'expense',
    garage: data.garage.id,
    vehicle: params.vehicleId,
    start: period.start,
    end: period.end,
    people: [...params.people].sort(),
    places: [...params.places].sort(),
    categories: [...params.categories].sort(),
    mentioning: foldText(params.mentioning),
    excluded: [...params.excludeIds].sort(),
    hide,
  })
  const content = JSON.stringify({ scope, sections, omitted, note: params.note, contact: params.contact })
  const print = fingerprint(content)
  const earlier = (ctx.earlierVersions ?? []).find((v) => v.fingerprint !== print)
  if (earlier) {
    notes.push(`An earlier version of this report, for the same scope and period, was generated on ${fmt.stamp(earlier.generatedAt)}. Records have changed since, so its figures differ from these.`)
  }

  const topCategories = [...byCategory].filter((c) => c.amount > 0).sort((a, b) => b.amount - a.amount).slice(0, 3)
  const topMax = Math.max(1, ...topCategories.map((c) => c.amount))

  return {
    kind: 'expense',
    version: 1,
    title: 'Expense report',
    subject,
    subjectDetail: single ? data.garage.name : data.garage.location || undefined,
    periodLabel: period.label,
    periodRange: rangeLabel,
    scope,
    note: params.note.trim() ? { from: data.account.name, text: params.note.trim() } : undefined,
    contact: { name: data.account.name, detail: params.contact.trim() || undefined },
    generated: { atLabel: fmt.stamp(ctx.generatedAt), by: data.account.name, dataAsOfLabel: fmt.stamp(data.snapshotAt) },
    headline: hide
      ? { label: 'Records', value: fmt.int(items.length), caption: 'Amounts are left out of this copy' }
      : { label: 'Spent', value: fmt.moneyCode(total), caption: fmt.count(items.length, 'record') },
    highlights: hide
      ? []
      : topCategories.map((c) => ({ label: CATEGORY_LABEL[c.key], value: fmt.money(c.amount), share: fmt.pct(Math.round((c.amount / Math.max(1, total)) * 100)), fraction: c.amount / topMax })),
    sections,
    omitted,
    notes,
    showContents: sections.length >= 7 || items.length > 40,
    filename: fileSafe(
      `Carma expense report - ${single ? vehicleShort(single) : data.garage.name}${sel.mentioning ? ` - ${sel.mentioning.slice(0, 40)}` : ''}${sel.filteredByPerson ? ' - filtered' : ''} - ${period.start} to ${period.end}.pdf`,
    ),
    fingerprint: print,
    identity,
    recordCount: items.length,
  }
}

// ---------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------

/** A record's written detail, with money scrubbed out when the sender hid amounts. */
function detailFor(r: Rec, hide: boolean, currency: string): string | undefined {
  const detail = recordDetail(r)
  if (!detail) return undefined
  return hide ? scrubAmounts(detail, currency) || undefined : detail
}

function changeCell(fmt: Fmt, now: number, before: number) {
  const diff = now - before
  if (before === 0) return { text: fmt.signedMoney(diff), sub: 'none before' }
  return { text: fmt.signedMoney(diff), sub: fmt.signedPct(Math.round((diff / before) * 100)) }
}

/** Per-kilometre figures need the whole vehicle's spend against its whole distance. */
function perKmBlocked(sel: ExpenseSelection): string | null {
  if (sel.filteredByPerson) return 'the report is limited to some people, and distance can’t be split by who entered the spend'
  if (sel.filteredByPlace) return 'the report is limited to some places, and distance can’t be split by where money was spent'
  if (sel.mentioning) return `the report is limited to records mentioning “${sel.mentioning}”, and distance can’t be split by item`
  if (sel.items.length < 3) return 'there are too few records in the period'
  return null
}

function byVehicleSection(data: OwnerDataset, sel: ExpenseSelection, fmt: Fmt, hide: boolean, total: number): Section {
  const blocked = perKmBlocked(sel)
  const rows = sel.vehicles.map((v) => {
    const recs = sel.items.filter((r) => r.vehicleId === v.id)
    const amount = sum(recs.map((r) => r.amount))
    const distance = blocked ? null : distanceInPeriod(readingsFor(data.records, v.id), sel.period.start, sel.period.end, fmt)
    const ok = distance?.ok ? distance : null
    const spend = ok ? spendInWindow(sel.items, v.id, ok) : 0
    const fuel = ok ? spendInWindow(sel.items, v.id, ok, (r) => r.category === 'fuel') : 0
    return {
      v,
      count: recs.length,
      amount,
      distance,
      perKm: ok ? spend / 100 / ok.km : null,
      fuelPerKm: ok && fuel > 0 ? fuel / 100 / ok.km : null,
      fuelMinor: fuel,
      km: ok?.km ?? 0,
      cls: `${v.powertrain ? `${v.powertrain.toLowerCase()} ` : ''}${v.type === 'motorcycle' ? 'motorcycles' : 'cars'}`,
    }
  })
  rows.sort((a, b) => (hide ? b.count - a.count : b.amount - a.amount) || vehicleName(a.v).localeCompare(vehicleName(b.v)))

  // Class averages for fuel per km (FLEET-05): only where a class has two vehicles to compare.
  const classRate = new Map<string, number>()
  for (const cls of new Set(rows.map((r) => r.cls))) {
    const members = rows.filter((r) => r.cls === cls && r.fuelPerKm != null)
    if (members.length >= 2) classRate.set(cls, sum(members.map((m) => m.fuelMinor)) / 100 / sum(members.map((m) => m.km)))
  }

  const { pct } = shares(rows.map((r) => r.amount), total)
  const columns: Column[] = hide
    ? [
        { key: 'vehicle', label: 'Vehicle', width: 3 },
        { key: 'records', label: 'Records', align: 'right' },
      ]
    : [
        { key: 'vehicle', label: 'Vehicle', width: 2.6 },
        { key: 'records', label: 'Records', align: 'right', width: 0.9 },
        { key: 'spent', label: 'Spent', align: 'right', width: 1.3 },
        { key: 'share', label: 'Share', align: 'right', width: 0.8 },
        { key: 'perKm', label: 'Per km', align: 'right', width: 1 },
        { key: 'fuelPerKm', label: 'Fuel per km', align: 'right', width: 1.1 },
      ]
  const tableRows: Row[] = rows.map((r, i) => {
    const marks: string[] = []
    const avg = classRate.get(r.cls)
    if (!hide && avg != null && r.fuelPerKm != null && r.fuelPerKm >= avg * 1.2) {
      marks.push(`Fuel per km is ${Math.round((r.fuelPerKm / avg - 1) * 100)}% above the average for ${r.cls} in this report (${fmt.currency} ${fmt.rate(avg)})`)
    }
    return {
      cells: {
        vehicle: { text: vehicleName(r.v), sub: r.v.plate ?? undefined },
        records: fmt.int(r.count),
        spent: fmt.money(r.amount),
        share: fmt.pct(pct[i]!),
        perKm: r.perKm != null ? fmt.rate(r.perKm) : '—',
        fuelPerKm: r.fuelPerKm != null ? fmt.rate(r.fuelPerKm) : '—',
      },
      marks,
      tone: r.count === 0 ? 'muted' : undefined,
    }
  })
  const blocks: Block[] = [
    {
      kind: 'table',
      columns,
      rows: tableRows,
      footer: hide ? undefined : { cells: { vehicle: 'All vehicles', records: fmt.int(sel.items.length), spent: fmt.money(total), share: '', perKm: '', fuelPerKm: '' } },
      caption: hide ? undefined : `Ranked by spend. Per-km figures are in ${fmt.currency} and use one rule for every vehicle: spend between the first and last odometer reading in the period, over the distance between them.`,
    },
  ]
  if (!hide) {
    const withheld = rows.filter((r) => r.count > 0 && r.perKm == null)
    if (blocked) blocks.push({ kind: 'note', tone: 'muted', text: `Per-kilometre figures are withheld because ${blocked}.` })
    else if (withheld.length > 0) {
      blocks.push({
        kind: 'list',
        items: withheld.map((r) => `${vehicleFull(r.v)} is left out of the per-km comparison: ${r.distance && !r.distance.ok ? r.distance.reason : 'not enough odometer coverage'}.`),
      })
    }
    // Per-vehicle × per-category totals for closing a month (FLEET-01).
    const cats = CATEGORY_ORDER.filter((c) => sel.items.some((r) => r.category === c))
    blocks.push({
      kind: 'table',
      columns: [
        { key: 'vehicle', label: 'Vehicle', width: 2.2 },
        ...cats.map((c) => ({ key: c, label: CATEGORY_SHORT[c], align: 'right' as const, width: 1 })),
        { key: 'total', label: 'Total', align: 'right', width: 1.1 },
      ],
      rows: rows.map((r) => ({
        cells: {
          vehicle: vehicleShort(r.v),
          ...Object.fromEntries(cats.map((c) => [c, fmt.money(sum(sel.items.filter((x) => x.vehicleId === r.v.id && x.category === c).map((x) => x.amount)))])),
          total: fmt.money(r.amount),
        },
      })),
      footer: {
        cells: {
          vehicle: 'Total',
          ...Object.fromEntries(cats.map((c) => [c, fmt.money(sum(sel.items.filter((x) => x.category === c).map((x) => x.amount)))])),
          total: fmt.money(total),
        },
      },
      caption: 'The same spend by vehicle and category.',
    })
  }
  return { id: 'vehicles', title: 'By vehicle', stories: ['OWN-14', 'FLEET-01', 'FLEET-02', 'FLEET-03', 'FLEET-05'], blocks }
}

function intervalText(fmt: Fmt, basis: IntervalBasis): string {
  const fallback = `Carma's default for ${basis.classLabel}`
  if (basis.km == null && basis.months == null) return 'No service interval is set for this vehicle.'
  if (basis.km != null && basis.months != null) {
    return basis.kmSource === 'vehicle'
      ? `Service interval: every ${fmt.km(basis.km)} (set at the last service) or ${basis.months} months (${fallback}), whichever comes first.`
      : `Service interval: every ${fmt.km(basis.km)} or ${basis.months} months, whichever comes first (${fallback}).`
  }
  return basis.km != null
    ? `Service interval: every ${fmt.km(basis.km)} (${basis.kmSource === 'vehicle' ? 'set at the last service' : fallback}).`
    : `Service interval: every ${basis.months} months (${fallback}).`
}

function serviceSection(data: OwnerDataset, sel: ExpenseSelection, vehicle: Vehicle, fmt: Fmt, hide: boolean, today: string): Section {
  const { period } = sel
  const vehicleRecords = data.records.filter((r) => r.vehicleId === vehicle.id).sort(byDate)
  const services = vehicleRecords.filter((r) => isService(r) && r.date <= period.end)
  const basis = serviceIntervalFor(vehicle, services, data.serviceIntervals)
  const blocks: Block[] = []

  // Coverage (OWN-09).
  const upToEnd = vehicleRecords.filter((r) => r.date <= period.end)
  const first = upToEnd[0]
  const last = upToEnd[upToEnd.length - 1]
  if (first && last) {
    const gaps = maintenanceGaps(vehicleRecords, basis, period.start, period.end)
    blocks.push({
      kind: 'facts',
      items: [
        { label: 'First record', value: fmt.dateLong(first.date) },
        { label: 'Last record', value: fmt.dateLong(last.date) },
        {
          label: 'Gaps',
          value:
            basis.months == null
              ? 'Not checked — no service interval is set'
              : gaps.length === 0
                ? `None longer than ${basis.months} months without a service or repair`
                : fmt.count(gaps.length, 'stretch', 'stretches') + ` longer than ${basis.months} months without a service or repair`,
          tone: gaps.length > 0 ? 'warning' : 'default',
        },
      ],
    })
    if (gaps.length > 0) {
      blocks.push({
        kind: 'list',
        items: gaps.map((g) =>
          g.open
            ? `No service or repair recorded since ${g.fromLabel === 'first record' ? 'the first record, on ' : ''}${fmt.dateLong(g.from)} (${monthsText(fmt, g.from, g.to)} to ${fmt.dateLong(g.to)}).`
            : `No service or repair recorded between ${fmt.dateLong(g.from)}${g.fromLabel === 'first record' ? ' (first record)' : ''} and ${fmt.dateLong(g.to)} — ${monthsText(fmt, g.from, g.to)}.`,
        ),
      })
    }
  }

  // History in the period (OWN-08).
  const work = sel.items.filter((r) => r.type === 'service' || r.type === 'repair' || (r.type === 'expense' && r.expenseCategory === 'SERVICE'))
  if (work.length > 0) {
    const columns: Column[] = [
      { key: 'date', label: 'Date', width: 1.1 },
      { key: 'km', label: 'Odometer', align: 'right', width: 1.1 },
      { key: 'work', label: 'Work done', width: 3.2 },
      { key: 'where', label: 'Where', width: 1.8 },
      ...(hide ? [] : [{ key: 'amount', label: 'Amount', align: 'right' as const, width: 1.1 }]),
    ]
    blocks.push({
      kind: 'table',
      columns,
      rows: work.map((r) => ({
        cells: {
          date: fmt.date(r.date),
          km: r.odometerKm != null ? fmt.int(r.odometerKm) : '—',
          work: { text: r.type === 'repair' ? `Repair: ${recordTitle(r)}` : 'Service', sub: detailFor(r, hide, fmt.currency) },
          where: r.place ?? '—',
          amount: fmt.money(r.amount),
        },
      })),
      caption: 'Services and repairs in the period, oldest first.',
    })
  } else {
    blocks.push({ kind: 'note', tone: 'muted', text: 'No services or repairs are recorded in this period.' })
  }

  // Interval adherence (WNTY-01) and the next one due (WNTY-02).
  if (services.length > 0) {
    const rows = adherence(services, basis)
    const late = rows.filter((r) => r.result === 'late').length
    const onTime = rows.filter((r) => r.result === 'on-time').length
    blocks.push({
      kind: 'table',
      columns: [
        { key: 'date', label: 'Serviced', width: 1.1 },
        { key: 'km', label: 'Odometer', align: 'right', width: 1.1 },
        { key: 'due', label: 'Was due by', width: 2.4 },
        { key: 'result', label: 'On schedule?', width: 2 },
      ],
      rows: rows.map((a) => ({
        cells: {
          date: fmt.date(a.record.date),
          km: a.record.odometerKm != null ? fmt.int(a.record.odometerKm) : '—',
          due:
            a.result === 'first'
              ? '—'
              : [a.dueKm != null ? fmt.km(a.dueKm) : null, a.dueDate ? fmt.dateLong(a.dueDate) : null].filter(Boolean).join(' or ') || '—',
          result: { text: adherenceText(fmt, a), tone: a.result === 'late' ? 'warning' : 'default' },
        },
        tone: a.result === 'late' ? 'warning' : undefined,
      })),
      caption: `${intervalText(fmt, basis)} ${fmt.count(rows.length, 'service')} on record: ${onTime} on schedule, ${late} late${rows.length - onTime - late > 0 ? `, ${rows.length - onTime - late} with nothing earlier to measure against` : ''}.`,
    })
    const currentKm = Math.max(vehicle.odometerKm, ...vehicleRecords.map((r) => r.odometerKm ?? 0))
    const next = nextService(services, basis, currentKm > 0 ? currentKm : null, today)
    if (next) blocks.push(nextServiceNote(fmt, next))
  } else {
    blocks.push({ kind: 'note', tone: 'muted', text: `No services are recorded for this vehicle, so adherence to the service interval can't be shown. ${intervalText(fmt, basis)}` })
  }

  return { id: 'history', title: 'Service history and coverage', stories: ['OWN-08', 'OWN-09', 'WNTY-01', 'WNTY-02', 'WNTY-03'], blocks }
}

function adherenceText(fmt: Fmt, a: ReturnType<typeof adherence>[number]): string {
  if (a.result === 'first') return 'First service on record'
  if (a.result === 'unknown') return 'Can’t tell — no odometer at the earlier service'
  if (a.result === 'on-time') return 'Yes'
  const parts = [a.lateKm > 0 ? fmt.km(a.lateKm) : null, a.lateDays > 0 ? fmt.count(a.lateDays, 'day') : null].filter(Boolean)
  return `Late by ${parts.join(' and ')}`
}

function nextServiceNote(fmt: Fmt, next: NonNullable<ReturnType<typeof nextService>>): Block {
  const due = [next.dueKm != null ? `at ${fmt.km(next.dueKm)}` : null, next.dueDate ? `by ${fmt.dateLong(next.dueDate)}` : null].filter(Boolean).join(' or ')
  const overdue = (next.kmLeft != null && next.kmLeft < 0) || (next.daysLeft != null && next.daysLeft < 0)
  const left = [
    next.kmLeft != null ? (next.kmLeft < 0 ? `${fmt.km(-next.kmLeft)} over` : `${fmt.km(next.kmLeft)} to go`) : null,
    next.daysLeft != null ? (next.daysLeft < 0 ? `${fmt.count(-next.daysLeft, 'day')} past the date` : `${fmt.count(next.daysLeft, 'day')} to go`) : null,
  ]
    .filter(Boolean)
    .join(', ')
  return {
    kind: 'note',
    tone: overdue ? 'warning' : 'default',
    text: `${overdue ? 'The next service is overdue' : 'Next service due'} ${due}${left ? ` (${left})` : ''}.`,
  }
}

function dueSection(data: OwnerDataset, sel: ExpenseSelection, fmt: Fmt, hide: boolean, total: number, today: string): Section {
  const blocks: Block[] = []
  const ids = new Set(sel.vehicles.map((v) => v.id))
  const multi = sel.vehicles.length > 1
  const vehicleById = new Map(data.vehicles.map((v) => [v.id, v]))

  // Documents with an expiry (FLEET-09): expired first, then soonest.
  const docs = data.documents
    .filter((d) => ids.has(d.vehicleId) && d.expiryDate)
    .map((d) => ({ d, left: daysBetween(today, d.expiryDate!) }))
    .sort((a, b) => a.left - b.left || a.d.title.localeCompare(b.d.title))
  if (docs.length > 0) {
    blocks.push({
      kind: 'table',
      columns: [
        ...(multi ? [{ key: 'vehicle', label: 'Vehicle', width: 1.4 }] : []),
        { key: 'doc', label: 'Document', width: 2.6 },
        { key: 'expires', label: 'Expires', width: 1.3 },
        { key: 'status', label: 'Status', width: 1.6 },
      ],
      rows: docs.map(({ d, left }) => ({
        cells: {
          vehicle: vehicleShort(vehicleById.get(d.vehicleId)!),
          doc: { text: d.title, sub: d.typeLabel },
          expires: fmt.date(d.expiryDate!),
          status: { text: left < 0 ? `Expired ${fmt.count(-left, 'day')} ago` : left === 0 ? 'Expires today' : `${fmt.count(left, 'day')} left`, tone: left <= 30 ? 'warning' : 'default' },
        },
        tone: left < 0 ? 'warning' : undefined,
      })),
      caption: 'Documents with an expiry date, expired first.',
    })
  }

  // Services coming up, per vehicle (OWN-07).
  const serviceRows: Row[] = []
  for (const v of sel.vehicles) {
    const recs = data.records.filter((r) => r.vehicleId === v.id).sort(byDate)
    const services = recs.filter(isService)
    const basis = serviceIntervalFor(v, services, data.serviceIntervals)
    const currentKm = Math.max(v.odometerKm, ...recs.map((r) => r.odometerKm ?? 0))
    const next = nextService(services, basis, currentKm > 0 ? currentKm : null, today)
    if (next) {
      const overdue = (next.kmLeft != null && next.kmLeft < 0) || (next.daysLeft != null && next.daysLeft < 0)
      serviceRows.push({
        cells: {
          vehicle: vehicleShort(v),
          due: [next.dueKm != null ? fmt.km(next.dueKm) : null, next.dueDate ? fmt.dateLong(next.dueDate) : null].filter(Boolean).join(' or '),
          status: {
            text: overdue
              ? 'Overdue'
              : [next.kmLeft != null ? `${fmt.km(next.kmLeft)} to go` : null, next.daysLeft != null ? fmt.count(next.daysLeft, 'day') : null].filter(Boolean).join(' · '),
            tone: overdue ? 'warning' : 'default',
          },
        },
        tone: overdue ? 'warning' : undefined,
      })
      continue
    }
    for (const r of data.reminders.filter((x) => x.vehicleId === v.id && x.kind === 'SERVICE_DUE')) {
      serviceRows.push({
        cells: {
          vehicle: vehicleShort(v),
          due: [r.dueKm != null ? fmt.km(r.dueKm) : null, r.dueDate ? fmt.dateLong(r.dueDate) : null].filter(Boolean).join(' or ') || r.description,
          status: 'From a reminder',
        },
      })
    }
  }
  if (serviceRows.length > 0) {
    blocks.push({
      kind: 'table',
      columns: [
        { key: 'vehicle', label: 'Vehicle', width: 1.4 },
        { key: 'due', label: 'Next service due', width: 2.6 },
        { key: 'status', label: 'Status', width: 1.8 },
      ],
      rows: serviceRows,
      caption: 'Worked out from the last service and the service interval.',
    })
  }

  // Projection from the observed run rate (OWN-07) — never mixed with spend.
  if (!hide && sel.period.days >= 90 && sel.items.length >= 5 && sel.period.preset !== 'allTime') {
    const perDay = total / sel.period.days
    const projected = roundSignificant(perDay * 365, 2)
    blocks.push({
      kind: 'facts',
      items: [{ label: 'Projection, next 12 months', value: `About ${fmt.moneyCode(projected)}` }],
    })
    blocks.push({
      kind: 'note',
      tone: 'muted',
      text: `A projection, not spend: this period's rate of ${fmt.moneyCode(fmt.fractionDigits === 0 ? Math.round(perDay / 100) * 100 : Math.round(perDay))} a day carried over a year. One-off costs in the period carry over too.`,
    })
  }

  return { id: 'due', title: 'What is due next', stories: ['OWN-07', 'FLEET-09'], blocks }
}

function buildSection(project: OwnerDataset['projects'][number], fmt: Fmt, hide: boolean): { section: Section; omissions: Omission[] } {
  const STATUS = { done: 'Done', 'in-progress': 'In progress', 'not-started': 'Not started' } as const
  const stageSpent = (s: (typeof project.stages)[number]) => sum([...s.modifications.map((m) => m.cost), ...s.parts.map((p) => p.cost)])
  const spent = sum(project.stages.map(stageSpent))
  const items = sum(project.stages.map((s) => s.modifications.length + s.parts.length))
  const blocks: Block[] = [
    {
      kind: 'table',
      columns: [
        { key: 'stage', label: 'Stage', width: 2.4 },
        { key: 'status', label: 'Status', width: 1.2 },
        { key: 'items', label: 'Items', align: 'right', width: 0.8 },
        ...(hide ? [] : [{ key: 'spent', label: 'Spent', align: 'right' as const, width: 1.2 }]),
      ],
      rows: project.stages.map((s) => ({
        cells: { stage: s.name, status: STATUS[s.status], items: fmt.int(s.modifications.length + s.parts.length), spent: fmt.money(stageSpent(s)) },
      })),
      footer: hide ? undefined : { cells: { stage: 'All stages', status: '', items: fmt.int(items), spent: fmt.money(spent) } },
      caption: `${project.name ?? 'Project build'} — build spend is tracked by stage and is not part of the period total above.`,
    },
  ]
  if (!hide && project.budget > 0) {
    const variance = spent - project.budget
    blocks.push({
      kind: 'facts',
      items: [
        { label: 'Budget', value: fmt.moneyCode(project.budget) },
        { label: 'Spent so far', value: `${fmt.moneyCode(spent)} (${fmt.pct(Math.round((spent / project.budget) * 100))} of budget)` },
        variance > 0
          ? { label: 'Over budget by', value: `${fmt.moneyCode(variance)} (${fmt.signedPct(Math.round((variance / project.budget) * 100))})`, tone: 'warning' }
          : { label: 'Budget remaining', value: fmt.moneyCode(-variance) },
        { label: 'Documented build investment', value: `${fmt.moneyCode(spent)} across ${fmt.count(items, 'item')}; the purchase price is not recorded` },
      ],
    })
  }
  const parts = project.stages.flatMap((s) => s.parts.map((p) => ({ ...p, stage: s.name })))
  parts.sort((a, b) => ((a.date ?? '') < (b.date ?? '') ? -1 : (a.date ?? '') > (b.date ?? '') ? 1 : a.name.localeCompare(b.name)))
  if (parts.length > 0) {
    blocks.push({
      kind: 'table',
      columns: [
        { key: 'part', label: 'Part', width: 2.6 },
        { key: 'supplier', label: 'Supplier', width: 2 },
        { key: 'date', label: 'Date', width: 1.1 },
        { key: 'stage', label: 'Stage', width: 1.6 },
        ...(hide ? [] : [{ key: 'cost', label: 'Cost', align: 'right' as const, width: 1.1 }]),
      ],
      rows: parts.map((p) => ({ cells: { part: p.name, supplier: p.supplier ?? '—', date: p.date ? fmt.date(p.date) : '—', stage: p.stage, cost: fmt.money(p.cost) } })),
      caption: 'Parts and provenance, oldest first. Brand and part number are not stored yet.',
    })
  }
  return {
    section: { id: 'build', title: 'Build stages', stories: ['PROJ-01', 'PROJ-03', 'PROJ-04'], blocks },
    omissions: [{ title: 'Estimate against actual by stage, and a forecast at completion', reason: 'Stage estimates are not stored in Carma yet, so neither can be worked out.' }],
  }
}

function recordsSection(
  data: OwnerDataset,
  sel: ExpenseSelection,
  fmt: Fmt,
  hide: boolean,
  total: number,
  vehicleById: Map<string, Vehicle>,
  multiVehicle: boolean,
): Section {
  const items = sel.items
  const number = new Map(items.map((r, i) => [r.id, i + 1]))
  const duplicateOf = new Map<string, number[]>()
  for (const group of findDuplicates(items)) {
    for (const r of group.records) {
      duplicateOf.set(
        r.id,
        group.records.filter((o) => o.id !== r.id).map((o) => number.get(o.id)!),
      )
    }
  }
  const columns: Column[] = [
    { key: 'n', label: '#', align: 'right', width: 0.65 },
    { key: 'date', label: 'Date', width: 1.35 },
    ...(multiVehicle ? [{ key: 'vehicle', label: 'Vehicle', width: 1.05 }] : []),
    { key: 'item', label: 'Item', width: 2.6 },
    { key: 'where', label: 'Where', width: 1.6 },
    { key: 'by', label: 'Entered by', width: 1.4 },
    { key: 'km', label: 'Odometer', align: 'right', width: 1 },
    ...(hide ? [] : [{ key: 'amount', label: 'Amount', align: 'right' as const, width: 1.1 }]),
  ]
  const rows: Row[] = items.map((r, i) => {
    const marks = entryMarks(r, fmt)
    const p = sel.person(r)
    const dups = duplicateOf.get(r.id)
    if (dups && dups.length > 0) marks.push(`Possible duplicate of #${dups.join(', #')}`)
    const detail = detailFor(r, hide, fmt.currency) ?? null
    const litres = r.type === 'fuel' && r.litres != null ? `${fmt.dec(r.litres, 1)} L` : null
    return {
      cells: {
        n: String(i + 1),
        date: fmt.date(r.date),
        vehicle: vehicleShort(vehicleById.get(r.vehicleId)!),
        item: { text: hide ? scrubAmounts(recordTitle(r), fmt.currency) : recordTitle(r), sub: [litres, r.type === 'repair' ? null : detail].filter(Boolean).join(' · ') || undefined },
        where: r.place ?? '—',
        by: { text: r.enteredByName, sub: p.former ? 'former member' : undefined },
        km: r.odometerKm != null ? fmt.int(r.odometerKm) : '—',
        amount: fmt.money(r.amount),
      },
      marks,
    }
  })
  const blocks: Block[] = [
    {
      kind: 'table',
      columns,
      rows,
      footer: hide ? undefined : { cells: { n: '', item: `Total of ${fmt.count(items.length, 'record')}`, amount: fmt.money(total) } },
      caption: 'Every record in the report, oldest first. Records entered or edited after the event say so.',
    },
  ]
  const ids = new Set(sel.vehicles.map((v) => v.id))
  const deleted = data.deletedRecords.filter((r) => ids.has(r.vehicleId) && r.date >= sel.period.start && r.date <= sel.period.end)
  // Deletions reconcile the whole period's total; a narrowed report has no such total, and they can't be filtered.
  if (deleted.length > 0 && !sel.narrowed) {
    blocks.push({
      kind: 'note',
      tone: 'muted',
      text: `${fmt.count(deleted.length, 'record')} in this period ${deleted.length === 1 ? 'was' : 'were'} deleted after entry and ${deleted.length === 1 ? 'is' : 'are'} left out of every total${hide ? '' : ` (${fmt.moneyCode(sum(deleted.map((r) => r.amount)))})`}.`,
    })
  }
  return { id: 'records', title: 'Every record', stories: ['SYS-03', 'TAX-03', 'SHARE-01', 'SHARE-05', 'SYS-15'], blocks }
}

function monthsText(fmt: Fmt, from: string, to: string): string {
  const months = Math.floor(daysBetween(from, to) / 30.44)
  return months >= 1 ? fmt.count(months, 'month') : fmt.count(daysBetween(from, to), 'day')
}
