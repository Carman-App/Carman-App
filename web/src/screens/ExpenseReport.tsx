import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { ErrorState, Loading, OfflineNote } from '../components/ui.tsx'
import { useActiveGarage } from '../data/active.ts'
import { readExpense, writeExpense } from '../data/params.ts'
import { localTimeZone, localToday, useGarageData } from '../data/queries.ts'
import { useTextScale } from '../data/textScale.ts'
import { ReportView } from '../render/ReportView.tsx'
import { earlierVersionsOf, recordGeneration, useArchive } from '../render/export.ts'
import { expenseCsv } from '../report/csv.ts'
import { normalizeGarageData } from '../report/dataset.ts'
import { buildExpenseReport } from '../report/expense.ts'
import type { ReportDoc } from '../report/model.ts'
import { ExportPanel } from './ExportPanel.tsx'
import { TextSize } from './TextSize.tsx'

export function ExpenseReport() {
  const [sp] = useSearchParams()
  const route = useMemo(() => readExpense(sp), [sp])
  const { garages, id: garageId } = useActiveGarage(route.garageId)
  const garageQuery = useGarageData(garageId)
  const archive = useArchive()
  const data = useMemo(() => (garageQuery.data ? normalizeGarageData(garageQuery.data.data) : null), [garageQuery.data])
  // One generation time per visit, so re-renders never change the document.
  const [generatedAt] = useState(() => new Date().toISOString())
  // The panel works on the document as opened — exactly what gets previewed is what gets sent.
  const [exportDoc, setExportDoc] = useState<ReportDoc | null>(null)
  const [scale, setScale] = useTextScale()
  const today = localToday()
  const timeZone = localTimeZone()

  const doc = useMemo(() => {
    if (!data) return null
    const ctx = { today, generatedAt, timeZone }
    const first = buildExpenseReport(data, route.params, ctx)
    const earlier = earlierVersionsOf(archive.data, first.identity)
    return earlier.length > 0 ? buildExpenseReport(data, route.params, { ...ctx, earlierVersions: earlier }) : first
  }, [data, route.params, today, generatedAt, timeZone, archive.data])

  const query = writeExpense({ garageId, params: route.params }).toString()

  if (garages.isLoading || garageQuery.isLoading) return <Loading label="Building the report…" />
  if (garages.isError) return <ErrorState error={garages.error} onRetry={() => void garages.refetch()} />
  if (garageQuery.isError) return <ErrorState error={garageQuery.error} onRetry={() => void garageQuery.refetch()} />
  if (!doc || !data) return null

  return (
    <>
      <div className="doc-toolbar">
        <Link className="btn btn-secondary" to={`/expense?${query}`}>
          ← Change the report
        </Link>
        <span className="spacer" />
        <TextSize scale={scale} onChange={setScale} />
        <button type="button" className="btn btn-primary" onClick={() => setExportDoc(doc)}>
          Check pages and send
        </button>
      </div>
      {garageQuery.data?.offline ? <OfflineNote savedAt={garageQuery.data.savedAt} /> : null}
      <ReportView doc={doc} scale={scale} />
      {exportDoc ? (
        <ExportPanel
          doc={exportDoc}
          generatedAt={generatedAt}
          route={`/expense/report?${query}`}
          csv={() => expenseCsv(data, route.params, today)}
          onRecord={(format) =>
            recordGeneration({
              scope: route.params.vehicleId ? 'VEHICLE' : 'GARAGE',
              scopeId: route.params.vehicleId ?? data.garage.id,
              periodLabel: `${exportDoc.periodLabel}, ${exportDoc.periodRange}`,
              format,
            })
          }
          onClose={() => setExportDoc(null)}
        />
      ) : null}
    </>
  )
}
