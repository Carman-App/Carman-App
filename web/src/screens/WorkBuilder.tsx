import { useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { ErrorState, Loading, OfflineNote, ToggleChip } from '../components/ui.tsx'
import { readWork, writeWork } from '../data/params.ts'
import { recall, remember } from '../data/presets.ts'
import { useActiveWorkshop } from '../data/active.ts'
import { localTimeZone, localToday, useWorkshopData } from '../data/queries.ts'
import { makeFmt } from '../report/fmt.ts'
import type { PeriodPreset } from '../report/period.ts'
import { workBuilderInfo, type WorkParams } from '../report/work.ts'
import { normalizeWorkshopData } from '../report/workDataset.ts'

const PERIODS: { preset: PeriodPreset; label: string }[] = [
  { preset: 'today', label: 'Today' },
  { preset: 'thisWeek', label: 'This week' },
  { preset: 'lastWeek', label: 'Last week' },
  { preset: 'thisMonth', label: 'This month' },
  { preset: 'lastMonth', label: 'Last month' },
  { preset: 'thisQuarter', label: 'This quarter' },
  { preset: 'ytd', label: 'Year to date' },
  { preset: 'last12Months', label: 'Last 12 months' },
  { preset: 'lastTaxYear', label: 'Last tax year' },
  { preset: 'custom', label: 'Choose dates' },
]


export function WorkBuilder() {
  const [sp, setSp] = useSearchParams()
  const navigate = useNavigate()
  const route = useMemo(() => readWork(sp), [sp])
  const { workshops, list, id: workshopId } = useActiveWorkshop(route.workshopId)
  const query = useWorkshopData(workshopId)
  const data = useMemo(() => (query.data ? normalizeWorkshopData(query.data.data) : null), [query.data])
  const today = localToday()
  const timeZone = localTimeZone()
  const params = useMemo(() => {
    const remembered = recall('contact')
    return !sp.has('contact') && remembered ? { ...route.params, contact: remembered } : route.params
  }, [route.params, sp])
  const info = useMemo(() => (data ? workBuilderInfo(data, params, today, timeZone) : null), [data, params, today, timeZone])
  const fmt = useMemo(() => (data ? makeFmt(data.conventions, { fractionDigits: 0, timeZone }) : null), [data, timeZone])
  const customers = useMemo(() => [...(data?.customers ?? [])].sort((a, b) => a.name.localeCompare(b.name)), [data])
  const vehicles = useMemo(() => {
    const seen = new Map<string, string>()
    for (const j of data?.jobs ?? []) if (!params.customerId || j.customerId === params.customerId) seen.set(j.vehicleKey, j.vehicleLabel)
    return [...seen.entries()].sort((a, b) => a[1].localeCompare(b[1]))
  }, [data, params.customerId])

  const go = (next: WorkParams, wid = workshopId) => setSp(writeWork({ workshopId: wid, params: next }), { replace: true })
  const update = (patch: Partial<WorkParams>) => go({ ...params, ...patch })
  const link = writeWork({ workshopId, params }).toString()

  if (workshops.isLoading) return <Loading label="Loading your workshops…" />
  if (workshops.isError) return <ErrorState error={workshops.error} onRetry={() => void workshops.refetch()} />
  if (list.length === 0) {
    return (
      <div className="empty">
        <p>You don’t run a workshop on Carma yet. When you do, its jobs, invoices and payments can be reported here.</p>
      </div>
    )
  }

  return (
    <>
      <div className="page-head">
        <p className="eyebrow">Work report</p>
        <h1 className="page-title">What did the workshop earn, and who still owes?</h1>
        <p className="page-lede">Invoiced against collected, who owes and for how long, the bench, customers and every job — in the measures the trade already uses.</p>
      </div>
      {query.data?.offline ? <OfflineNote savedAt={query.data.savedAt} /> : null}

      <div className="builder">
        <div>
          <div className="panel">
            {list.length > 1 ? (
              <div className="field">
                <label className="field-label" htmlFor="workshop">
                  Workshop
                </label>
                <select
                  id="workshop"
                  className="select"
                  value={workshopId ?? ''}
                  onChange={(e) => {
                    remember('workshopId', e.target.value)
                    go({ ...params, mechanicIds: [], customerId: null, vehicleKey: null }, e.target.value)
                  }}
                >
                  {list.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
            <fieldset className="field">
              <legend>Period</legend>
              <div className="chips">
                {PERIODS.map((p) => (
                  <ToggleChip key={p.preset} on={params.period.preset === p.preset} onClick={() => update({ period: p.preset === 'custom' ? { preset: 'custom', start: info?.period.start, end: info?.period.end } : { preset: p.preset } })}>
                    {p.label}
                  </ToggleChip>
                ))}
              </div>
              {params.period.preset === 'custom' ? (
                <div className="row" style={{ marginTop: 10 }}>
                  <label>
                    <span className="field-label">From</span>
                    <input type="date" className="input" value={params.period.start ?? ''} max={today} onChange={(e) => update({ period: { ...params.period, start: e.target.value } })} />
                  </label>
                  <label>
                    <span className="field-label">To</span>
                    <input type="date" className="input" value={params.period.end ?? ''} max={today} onChange={(e) => update({ period: { ...params.period, end: e.target.value } })} />
                  </label>
                </div>
              ) : null}
              {info && fmt ? (
                <p className="field-hint">
                  {info.period.label}: {fmt.dateLong(info.period.start)} – {fmt.dateLong(info.period.end)}. A day or a week adds takings by payment method, for closing the till.
                </p>
              ) : null}
            </fieldset>
          </div>

          <div className="panel">
            <fieldset className="field">
              <legend>Mechanics</legend>
              <div className="chips">
                <ToggleChip on={params.mechanicIds.length === 0} onClick={() => update({ mechanicIds: [] })}>
                  The whole bench
                </ToggleChip>
                {data?.members.map((m) => (
                  <ToggleChip
                    key={m.id}
                    on={params.mechanicIds.includes(m.id)}
                    onClick={() => update({ mechanicIds: params.mechanicIds.includes(m.id) ? params.mechanicIds.filter((x) => x !== m.id) : [...params.mechanicIds, m.id] })}
                  >
                    {m.name}
                  </ToggleChip>
                ))}
              </div>
            </fieldset>
            <div className="row" style={{ marginTop: 18 }}>
              <label>
                <span className="field-label">One customer’s statement</span>
                <select className="select" value={params.customerId ?? ''} onChange={(e) => update({ customerId: e.target.value || null, vehicleKey: null })}>
                  <option value="">All customers</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className="field-label">One vehicle’s work record</span>
                <select className="select" value={params.vehicleKey ?? ''} onChange={(e) => update({ vehicleKey: e.target.value || null })}>
                  <option value="">All vehicles</option>
                  {vehicles.map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <p className="field-hint">A customer turns the report into their statement, with opening and closing balances. A vehicle turns it into the work record you send its owner.</p>
          </div>

          <div className="panel">
            <div className="field">
              <label className="field-label" htmlFor="note">
                A note on the first page (optional)
              </label>
              <textarea id="note" className="textarea" maxLength={600} value={params.note} onChange={(e) => update({ note: e.target.value })} placeholder="e.g. Statement for September — payment by the 10th, please." />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="contact">
                How the reader can reach you (optional)
              </label>
              <input
                id="contact"
                className="input"
                maxLength={120}
                value={params.contact}
                placeholder="Phone or email"
                onChange={(e) => {
                  remember('contact', e.target.value)
                  update({ contact: e.target.value })
                }}
              />
            </div>
          </div>
        </div>

        <aside className="builder-side">
          <div className="panel" aria-live="polite">
            {query.isLoading ? <Loading /> : null}
            {query.isError ? <ErrorState error={query.error} onRetry={() => void query.refetch()} /> : null}
            {info && fmt && data ? (
              <>
                <p className="eyebrow">{data.workshop.name}</p>
                <p className="summary-figure">{fmt.moneyCode(info.invoiced)}</p>
                <p className="summary-meta">
                  invoiced · {info.invoices} invoice{info.invoices === 1 ? '' : 's'} · {info.jobs} job{info.jobs === 1 ? '' : 's'} taken in · {info.period.label}
                </p>
                <button type="button" className="btn btn-primary btn-block" style={{ marginTop: 16 }} onClick={() => navigate(`/work/report?${link}`)}>
                  Build the report
                </button>
              </>
            ) : null}
          </div>
        </aside>
      </div>
    </>
  )
}
