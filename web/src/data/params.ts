import type { CategoryKey } from '../report/dataset.ts'
import { CATEGORY_ORDER } from '../report/dataset.ts'
import { DEFAULT_EXPENSE_PARAMS, type ExpenseParams } from '../report/expense.ts'
import type { PeriodPreset } from '../report/period.ts'
import { DEFAULT_WORK_PARAMS, type WorkParams } from '../report/work.ts'

/**
 * Report parameters live in the URL, so a report is a link: Back works,
 * a builder state can be bookmarked, and a saved preset is just a query
 * string with its period type kept rolling (SYS-13).
 */

const PRESETS: PeriodPreset[] = [
  'today',
  'thisWeek',
  'lastWeek',
  'thisMonth',
  'lastMonth',
  'thisQuarter',
  'lastQuarter',
  'ytd',
  'last12Months',
  'thisTaxYear',
  'lastTaxYear',
  'allTime',
  'custom',
]

function readPeriod(sp: URLSearchParams, fallback: PeriodPreset) {
  const p = sp.get('p') as PeriodPreset | null
  const preset = p && PRESETS.includes(p) ? p : fallback
  return preset === 'custom' ? { preset, start: sp.get('from') ?? undefined, end: sp.get('to') ?? undefined } : { preset }
}

function writePeriod(sp: URLSearchParams, period: ExpenseParams['period']) {
  sp.set('p', period.preset)
  if (period.preset === 'custom') {
    if (period.start) sp.set('from', period.start)
    if (period.end) sp.set('to', period.end)
  }
}

export type ExpenseRoute = { garageId: string | null; params: ExpenseParams }

export function readExpense(sp: URLSearchParams): ExpenseRoute {
  return {
    garageId: sp.get('g'),
    params: {
      vehicleId: sp.get('v'),
      period: readPeriod(sp, DEFAULT_EXPENSE_PARAMS.period.preset),
      people: sp.getAll('who'),
      places: sp.getAll('at'),
      categories: sp.getAll('cat').filter((c): c is CategoryKey => (CATEGORY_ORDER as string[]).includes(c)),
      mentioning: sp.get('q') ?? '',
      excludeIds: sp.getAll('x'),
      hideAmounts: sp.get('hide') === '1',
      distanceOnly: sp.get('dist') === '1',
      ratePerKm: sp.get('rate') ?? '',
      note: sp.get('note') ?? '',
      contact: sp.get('contact') ?? '',
    },
  }
}

export function writeExpense({ garageId, params }: ExpenseRoute): URLSearchParams {
  const sp = new URLSearchParams()
  if (garageId) sp.set('g', garageId)
  if (params.vehicleId) sp.set('v', params.vehicleId)
  writePeriod(sp, params.period)
  for (const w of params.people) sp.append('who', w)
  for (const a of params.places) sp.append('at', a)
  for (const c of params.categories) sp.append('cat', c)
  // Untrimmed, so a space typed between two words survives the round trip.
  if (params.mentioning) sp.set('q', params.mentioning)
  for (const x of params.excludeIds) sp.append('x', x)
  if (params.hideAmounts) sp.set('hide', '1')
  if (params.distanceOnly) sp.set('dist', '1')
  if (params.distanceOnly && params.ratePerKm) sp.set('rate', params.ratePerKm)
  if (params.note) sp.set('note', params.note)
  if (params.contact) sp.set('contact', params.contact)
  return sp
}

export type WorkRoute = { workshopId: string | null; params: WorkParams }

export function readWork(sp: URLSearchParams): WorkRoute {
  return {
    workshopId: sp.get('w'),
    params: {
      period: readPeriod(sp, DEFAULT_WORK_PARAMS.period.preset),
      mechanicIds: sp.getAll('mech'),
      customerId: sp.get('cust'),
      vehicleKey: sp.get('veh'),
      note: sp.get('note') ?? '',
      contact: sp.get('contact') ?? '',
    },
  }
}

export function writeWork({ workshopId, params }: WorkRoute): URLSearchParams {
  const sp = new URLSearchParams()
  if (workshopId) sp.set('w', workshopId)
  writePeriod(sp, params.period)
  for (const m of params.mechanicIds) sp.append('mech', m)
  if (params.customerId) sp.set('cust', params.customerId)
  if (params.vehicleKey) sp.set('veh', params.vehicleKey)
  if (params.note) sp.set('note', params.note)
  if (params.contact) sp.set('contact', params.contact)
  return sp
}

/** A preset keeps scope, filters and the period type, so the period rolls forward; one-off choices (duplicates left out) are dropped. */
export function presetQuery(sp: URLSearchParams): string {
  const copy = new URLSearchParams(sp)
  copy.delete('x')
  return copy.toString()
}
