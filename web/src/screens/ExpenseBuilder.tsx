import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { ErrorState, Loading, OfflineNote, ToggleChip } from '../components/ui.tsx'
import { readExpense, writeExpense, presetQuery } from '../data/params.ts'
import { useActiveGarage } from '../data/active.ts'
import { deletePreset, loadPresets, recall, remember, savePreset, type Preset } from '../data/presets.ts'
import { localToday, useGarageData } from '../data/queries.ts'
import { CATEGORY_LABEL, CATEGORY_ORDER, normalizeGarageData, recordTitle, vehicleName, type CategoryKey } from '../report/dataset.ts'
import { expenseBuilderInfo, type ExpenseParams } from '../report/expense.ts'
import { makeFmt } from '../report/fmt.ts'
import { mileageProblem, parseRate } from '../report/mileage.ts'
import { resolvePeriod, type PeriodPreset } from '../report/period.ts'

/** A mileage claim has to stay on one page, so its note stays to a line or two (OWN-13). */
const NOTE_MAX_ONE_PAGE = 160

const PERIODS: { preset: PeriodPreset; label: string }[] = [
  { preset: 'thisMonth', label: 'This month' },
  { preset: 'lastMonth', label: 'Last month' },
  { preset: 'thisQuarter', label: 'This quarter' },
  { preset: 'lastQuarter', label: 'Last quarter' },
  { preset: 'ytd', label: 'Year to date' },
  { preset: 'last12Months', label: 'Last 12 months' },
  { preset: 'thisTaxYear', label: 'This tax year' },
  { preset: 'lastTaxYear', label: 'Last tax year' },
  { preset: 'allTime', label: 'All records' },
  { preset: 'custom', label: 'Choose dates' },
]


export function ExpenseBuilder() {
  const [sp, setSp] = useSearchParams()
  const navigate = useNavigate()
  const route = useMemo(() => readExpense(sp), [sp])
  const { garages, list, id: garageId } = useActiveGarage(route.garageId)
  const garageQuery = useGarageData(garageId)
  const data = useMemo(() => (garageQuery.data ? normalizeGarageData(garageQuery.data.data) : null), [garageQuery.data])
  const today = localToday()
  const info = useMemo(() => (data ? expenseBuilderInfo(data, route.params, today) : null), [data, route.params, today])
  const fmt = useMemo(() => (data ? makeFmt(data.conventions, { fractionDigits: data.records.some((r) => r.amount % 100 !== 0) ? 2 : 0 }) : null), [data])
  const [presets, setPresets] = useState(() => loadPresets('expense'))
  const [presetName, setPresetName] = useState('')
  const [showAllPlaces, setShowAllPlaces] = useState(false)
  const [kept, setKept] = useState<string[]>([])
  // Open when a link arrives with filters on; after that it's the reader's to open and close.
  const [filtersOpen, setFiltersOpen] = useState(() => {
    const p = route.params
    return p.people.length + p.places.length + p.categories.length > 0 || p.mentioning.trim() !== ''
  })

  // The contact line is remembered on this device and offered again next time.
  const params = useMemo(() => {
    const remembered = recall('contact')
    return !sp.has('contact') && remembered ? { ...route.params, contact: remembered } : route.params
  }, [route.params, sp])
  const go = (next: ExpenseParams, gid = garageId) => setSp(writeExpense({ garageId: gid, params: next }), { replace: true })
  const update = (patch: Partial<ExpenseParams>) => go({ ...params, ...patch })
  const toggle = <T,>(list: T[], value: T) => (list.includes(value) ? list.filter((x) => x !== value) : [...list, value])
  const query = writeExpense({ garageId, params }).toString()

  if (garages.isLoading) return <Loading label="Loading your garages…" />
  if (garages.isError) return <ErrorState error={garages.error} onRetry={() => void garages.refetch()} />
  if (list.length === 0) {
    return (
      <div className="empty">
        <p>No garage yet. Add a vehicle in the Carma app and its records will be reportable here.</p>
      </div>
    )
  }

  const applyPreset = (p: Preset) => {
    const next = new URLSearchParams(p.query)
    if (!next.get('g') && garageId) next.set('g', garageId)
    setSp(next, { replace: true })
  }
  const builtIns: { name: string; hint: string; apply: () => void }[] = [
    { name: 'Monthly close', hint: 'Last month, whole garage, every record', apply: () => go({ ...params, vehicleId: null, period: { preset: 'lastMonth' }, people: [], places: [], categories: [], mentioning: '', distanceOnly: false, excludeIds: [] }) },
    { name: 'Tax year', hint: 'The last complete tax year', apply: () => go({ ...params, period: { preset: 'lastTaxYear' }, distanceOnly: false, excludeIds: [] }) },
    {
      name: 'Service history for a buyer',
      hint: 'One vehicle, all records, amounts left out',
      apply: () => go({ ...params, vehicleId: params.vehicleId ?? data?.vehicles[0]?.id ?? null, period: { preset: 'allTime' }, people: [], places: [], categories: [], mentioning: '', hideAmounts: true, distanceOnly: false, excludeIds: [] }),
    },
    {
      name: 'Mileage claim',
      hint: 'One vehicle, last month, distance only',
      apply: () =>
        go({ ...params, vehicleId: params.vehicleId ?? data?.vehicles[0]?.id ?? null, period: { preset: 'lastMonth' }, distanceOnly: true, ratePerKm: params.ratePerKm || recall('ratePerKm') || '', excludeIds: [] }),
    },
  ]

  const period = data ? resolvePeriod(params.period, { today, region: data.conventions.region }) : null
  // Groups not yet decided: neither kept as real nor with a record left out.
  const openDuplicates = info ? info.duplicates.filter((g) => !kept.includes(g.key) && !g.records.some((r) => params.excludeIds.includes(r.id))).length : 0
  const activeFilters = params.people.length + params.places.length + params.categories.length + (params.mentioning.trim() ? 1 : 0)
  // A mileage record is distance only: spending filters and duplicates don't apply to it.
  const distanceMode = params.distanceOnly && params.vehicleId != null
  const rate = parseRate(params.ratePerKm)
  const placeOptions = info ? (showAllPlaces ? info.places : info.places.slice(0, 12)) : []

  return (
    <>
      <div className="page-head">
        <p className="eyebrow">Expense report</p>
        <h1 className="page-title">{distanceMode ? 'How far did it go?' : 'What did it cost, and who spent it?'}</h1>
        <p className="page-lede">
          {distanceMode
            ? 'A mileage record: the opening and closing odometer for the period and the distance between them, on one page. What the vehicle cost stays out of it.'
            : 'Choose a period and what to cover. The report includes the sections your records can support, says what it leaves out, and states every filter — so it can be handed to anyone.'}
        </p>
      </div>

      {garageQuery.data?.offline ? <OfflineNote savedAt={garageQuery.data.savedAt} /> : null}

      <div className="builder">
        <div>
          <div className="panel">
            {list.length > 1 ? (
              <div className="field">
                <label className="field-label" htmlFor="garage">
                  Garage
                </label>
                <select
                  id="garage"
                  className="select"
                  value={garageId ?? ''}
                  onChange={(e) => {
                    remember('garageId', e.target.value)
                    go({ ...params, vehicleId: null, people: [], places: [], excludeIds: [] }, e.target.value)
                  }}
                >
                  {list.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            <fieldset className="field">
              <legend>Saved setups</legend>
              <div className="preset-row">
                {builtIns.map((b) => (
                  <button key={b.name} type="button" className="chip" onClick={b.apply} title={b.hint}>
                    {b.name}
                  </button>
                ))}
                {presets.map((p) => (
                  <span key={p.id} className="chip" style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
                    <button type="button" className="link-button" style={{ textDecoration: 'none', color: 'inherit' }} onClick={() => applyPreset(p)}>
                      {p.name}
                    </button>
                    <button
                      type="button"
                      className="preset-remove"
                      aria-label={`Delete saved setup ${p.name}`}
                      onClick={() => {
                        deletePreset(p.id)
                        setPresets(loadPresets('expense'))
                      }}
                    >
                      ✕
                    </button>
                  </span>
                ))}
              </div>
              <form
                className="row"
                style={{ marginTop: 10 }}
                onSubmit={(e) => {
                  e.preventDefault()
                  if (!presetName.trim()) return
                  savePreset('expense', presetName, presetQuery(new URLSearchParams(query)))
                  setPresets(loadPresets('expense'))
                  setPresetName('')
                }}
              >
                <input className="input" placeholder="Name this setup, e.g. Monthly to accountant" value={presetName} onChange={(e) => setPresetName(e.target.value)} aria-label="Name for this setup" maxLength={40} />
                <button type="submit" className="btn btn-secondary" style={{ flex: '0 0 auto' }} disabled={!presetName.trim()}>
                  Save setup
                </button>
              </form>
              <p className="field-hint">A saved setup keeps the scope and filters; its period rolls forward (last month is always last month).</p>
            </fieldset>
          </div>

          <div className="panel">
            <fieldset className="field">
              <legend>What to cover</legend>
              <div className="chips">
                <ToggleChip on={!params.vehicleId} onClick={() => update({ vehicleId: null, distanceOnly: false })} sub={data ? `${data.vehicles.length}` : undefined}>
                  Whole garage
                </ToggleChip>
                {data?.vehicles.map((v) => (
                  <ToggleChip key={v.id} on={params.vehicleId === v.id} onClick={() => update({ vehicleId: v.id })} sub={v.plate ?? undefined}>
                    {vehicleName(v)}
                  </ToggleChip>
                ))}
              </div>
            </fieldset>

            <fieldset className="field">
              <legend>Period</legend>
              <div className="chips">
                {PERIODS.map((p) => (
                  <ToggleChip key={p.preset} on={params.period.preset === p.preset} onClick={() => update({ period: p.preset === 'custom' ? { preset: 'custom', start: period?.start, end: period?.end } : { preset: p.preset } })}>
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
              {period && fmt ? (
                <p className="field-hint">
                  {period.label}: {fmt.dateLong(period.start)} – {fmt.dateLong(period.end)}
                </p>
              ) : null}
            </fieldset>
          </div>

          {distanceMode ? null : (
          <div className="panel">
            <details open={filtersOpen} onToggle={(e) => setFiltersOpen(e.currentTarget.open)}>
              <summary style={{ cursor: 'pointer', fontWeight: 500 }}>
                Narrow it down {activeFilters > 0 ? `· ${activeFilters} filter${activeFilters === 1 ? '' : 's'} on` : ''}
              </summary>
              <p className="field-hint">Filters combine, and every one you choose is printed on the report — a filtered report can never pass for a complete one.</p>

              <div className="field" style={{ marginTop: 14 }}>
                <label className="field-label" htmlFor="mentioning">
                  Records that mention
                </label>
                <input
                  id="mentioning"
                  className="input"
                  type="search"
                  maxLength={60}
                  placeholder="A part or job — e.g. brake pads, battery"
                  value={params.mentioning}
                  onChange={(e) => update({ mentioning: e.target.value })}
                />
                <p className="field-hint">Isolates one part or job — for a warranty claim, say. Searches what was written on each record.</p>
              </div>

              {info && info.people.length > 0 ? (
                <fieldset className="field">
                  <legend>Entered by</legend>
                  <div className="chips">
                    {info.people.map((p) => (
                      <ToggleChip key={p.key} on={params.people.includes(p.key)} onClick={() => update({ people: toggle(params.people, p.key) })} sub={`${p.count}${p.former ? ' · former' : ''}`}>
                        {p.name}
                      </ToggleChip>
                    ))}
                  </div>
                </fieldset>
              ) : null}

              {info && info.places.length > 0 ? (
                <fieldset className="field">
                  <legend>Spent at</legend>
                  <div className="chips">
                    {placeOptions.map((p) => (
                      <ToggleChip key={p.name || '(none)'} on={params.places.includes(p.name)} onClick={() => update({ places: toggle(params.places, p.name) })} sub={String(p.count)}>
                        {p.name || 'No place recorded'}
                      </ToggleChip>
                    ))}
                    {info.places.length > 12 ? (
                      <button type="button" className="link-button" onClick={() => setShowAllPlaces((v) => !v)}>
                        {showAllPlaces ? 'Fewer' : `All ${info.places.length} places`}
                      </button>
                    ) : null}
                  </div>
                </fieldset>
              ) : null}

              <fieldset className="field">
                <legend>Categories</legend>
                <div className="chips">
                  {CATEGORY_ORDER.map((c: CategoryKey) => (
                    <ToggleChip key={c} on={params.categories.includes(c)} onClick={() => update({ categories: toggle(params.categories, c) })}>
                      {CATEGORY_LABEL[c]}
                    </ToggleChip>
                  ))}
                </div>
              </fieldset>
              {activeFilters > 0 ? (
                <button type="button" className="link-button" style={{ marginTop: 12 }} onClick={() => update({ people: [], places: [], categories: [], mentioning: '' })}>
                  Clear filters
                </button>
              ) : null}
            </details>
          </div>
          )}

          <div className="panel">
            <fieldset className="field">
              <legend>For the person reading it</legend>
              {distanceMode ? null : (
                <label className="check">
                  <input type="checkbox" checked={params.hideAmounts} onChange={(e) => update({ hideAmounts: e.target.checked })} />
                  <span>
                    Leave amounts out
                    <small>Show what was done and when, not what it cost — for a buyer who needs proof of care, not prices. Stated on the report.</small>
                  </span>
                </label>
              )}
              <label className="check" style={{ marginTop: distanceMode ? 0 : 12 }}>
                <input
                  type="checkbox"
                  checked={distanceMode}
                  disabled={!params.vehicleId}
                  onChange={(e) => update({ distanceOnly: e.target.checked, ratePerKm: e.target.checked ? params.ratePerKm || recall('ratePerKm') || '' : params.ratePerKm })}
                />
                <span>
                  Distance only — for a mileage claim
                  <small>
                    {params.vehicleId
                      ? 'Opening and closing odometer and the distance between them, on one page. What the vehicle cost is left out.'
                      : 'Choose one vehicle above first: a mileage claim is for one vehicle.'}
                  </small>
                </span>
              </label>
            </fieldset>
            {distanceMode ? (
              <div className="field">
                <label className="field-label" htmlFor="rate">
                  Rate per km in {data?.conventions.currency ?? 'your currency'} (optional)
                </label>
                <input
                  id="rate"
                  className="input"
                  inputMode="decimal"
                  maxLength={12}
                  placeholder="e.g. 30"
                  value={params.ratePerKm}
                  aria-describedby="rate-hint"
                  onChange={(e) => {
                    remember('ratePerKm', e.target.value)
                    update({ ratePerKm: e.target.value })
                  }}
                />
                <p id="rate-hint" className={`field-hint${params.ratePerKm.trim() && rate == null ? ' tone-warning' : ''}`}>
                  {params.ratePerKm.trim() && rate == null
                    ? 'Enter a plain amount, like 30 or 24.50 — until then the record shows the distance only.'
                    : 'Your employer’s rate. It’s printed as yours, with the amount the distance comes to.'}
                </p>
              </div>
            ) : null}
            <div className="field">
              <label className="field-label" htmlFor="note">
                A note on the first page (optional)
              </label>
              <textarea
                id="note"
                className="textarea"
                maxLength={distanceMode ? NOTE_MAX_ONE_PAGE : 600}
                placeholder={distanceMode ? 'e.g. Mileage for August, client visits.' : 'Why you’re sending it — e.g. Service history for the Prado, as discussed.'}
                value={params.note}
                onChange={(e) => update({ note: e.target.value })}
              />
              <p className="field-hint">
                {distanceMode
                  ? 'A line or two at most — the record has to fit on one page. Printed as your words, signed with your name.'
                  : 'Printed as your words, signed with your name — clearly not Carma’s.'}
              </p>
            </div>
            <div className="field">
              <label className="field-label" htmlFor="contact">
                How the reader can reach you (optional)
              </label>
              <input
                id="contact"
                className="input"
                maxLength={120}
                placeholder="Phone or email"
                value={params.contact}
                onChange={(e) => {
                  remember('contact', e.target.value)
                  update({ contact: e.target.value })
                }}
              />
              <p className="field-hint">A reader who can ask about a line won’t fill a gap with suspicion.</p>
            </div>
          </div>

          {info && fmt && info.duplicates.length > 0 && !distanceMode ? (
            <div className="panel" id="duplicates">
              <h2 className="field-label">Check before you send — possible duplicates</h2>
              <p className="field-hint" style={{ marginTop: 0 }}>
                Same vehicle, same day, similar amount. Nothing is merged for you: keep both, or leave one out — the report will say you did.
              </p>
              <ul className="dup-list">
                {info.duplicates
                  .filter((g) => !kept.includes(g.key))
                  .map((g) => (
                    <li key={g.key} className="dup-item">
                      <p>
                        <strong>{recordTitle(g.records[0]!)}</strong> on {fmt.dateLong(g.records[0]!.date)}
                      </p>
                      <ul style={{ margin: '0 0 8px', paddingLeft: 18 }}>
                        {g.records.map((r) => {
                          const out = params.excludeIds.includes(r.id)
                          return (
                            <li key={r.id}>
                              {fmt.moneyCode(r.amount)} entered by {r.enteredByName}
                              {r.place ? ` at ${r.place}` : ''} —{' '}
                              <button type="button" className="link-button" onClick={() => update({ excludeIds: toggle(params.excludeIds, r.id) })}>
                                {out ? 'put it back' : 'leave this one out'}
                              </button>
                              {out ? <strong> (left out)</strong> : null}
                            </li>
                          )
                        })}
                      </ul>
                      <button type="button" className="btn btn-secondary" onClick={() => setKept((k) => [...k, g.key])}>
                        Keep both — they’re real
                      </button>
                    </li>
                  ))}
              </ul>
            </div>
          ) : null}
        </div>

        <aside className="builder-side">
          <div className="panel" aria-live="polite">
            {garageQuery.isLoading ? <Loading /> : null}
            {garageQuery.isError ? <ErrorState error={garageQuery.error} onRetry={() => void garageQuery.refetch()} /> : null}
            {info && fmt && data && distanceMode && info.mileage ? (
              <>
                <p className="eyebrow">{vehicleName(data.vehicles.find((v) => v.id === params.vehicleId) ?? data.vehicles[0]!)} · mileage</p>
                <p className="summary-figure">{info.mileage.ok ? fmt.km(info.mileage.km) : 'No distance'}</p>
                <p className="summary-meta">
                  {fmt.count(info.mileage.readings.length, 'odometer reading')} · {info.period.label}
                </p>
                {info.mileage.ok && rate != null ? (
                  <p className="summary-meta">
                    {(() => {
                      const f = makeFmt(data.conventions, { fractionDigits: rate % 100 !== 0 ? 2 : 0 })
                      return `${f.moneyCode(rate * info.mileage.km)} at ${f.moneyCode(rate)} per km`
                    })()}
                  </p>
                ) : null}
                {!info.mileage.ok ? (
                  <p className="summary-meta tone-warning" style={{ marginTop: 8 }}>
                    {mileageProblem(info.mileage, fmt)}
                  </p>
                ) : null}
                <button type="button" className="btn btn-primary btn-block" style={{ marginTop: 16 }} onClick={() => navigate(`/expense/report?${query}`)}>
                  Build the mileage record
                </button>
                <p className="field-hint" style={{ textAlign: 'center' }}>
                  You’ll see the page before anything is sent.
                </p>
              </>
            ) : info && fmt && data ? (
              <>
                <p className="eyebrow">{params.vehicleId ? vehicleName(data.vehicles.find((v) => v.id === params.vehicleId) ?? data.vehicles[0]!) : data.garage.name}</p>
                <p className="summary-figure">{params.hideAmounts ? `${info.recordCount} records` : fmt.moneyCode(info.total)}</p>
                <p className="summary-meta">
                  {params.hideAmounts ? 'Amounts left out' : `${info.recordCount} record${info.recordCount === 1 ? '' : 's'}`} · {info.period.label}
                </p>
                {activeFilters > 0 || params.excludeIds.length > 0 ? <p className="summary-meta">Filtered — the report will say how.</p> : null}
                {openDuplicates > 0 ? (
                  <p className="summary-meta tone-warning" style={{ marginTop: 8 }}>
                    {openDuplicates} possible duplicate{openDuplicates === 1 ? '' : 's'} to check — <a href="#duplicates">review</a>
                  </p>
                ) : null}
                <button type="button" className="btn btn-primary btn-block" style={{ marginTop: 16 }} onClick={() => navigate(`/expense/report?${query}`)}>
                  Build the report
                </button>
                <p className="field-hint" style={{ textAlign: 'center' }}>
                  You’ll see every page before anything is sent.
                </p>
              </>
            ) : null}
          </div>
          <p className="field-hint" style={{ marginTop: 12 }}>
            Reports you send are kept in the <Link to="/archive">archive</Link>, exactly as they were sent.
          </p>
        </aside>
      </div>
    </>
  )
}
