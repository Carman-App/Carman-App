import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { ErrorState, Loading, OfflineNote } from '../components/ui.tsx'
import { useActiveWorkshop } from '../data/active.ts'
import { readWork, writeWork } from '../data/params.ts'
import { localTimeZone, localToday, useWorkshopData } from '../data/queries.ts'
import { useTextScale } from '../data/textScale.ts'
import { ReportView } from '../render/ReportView.tsx'
import { earlierVersionsOf, useArchive } from '../render/export.ts'
import { workCsv } from '../report/csv.ts'
import type { ReportDoc } from '../report/model.ts'
import { buildWorkReport } from '../report/work.ts'
import { normalizeWorkshopData } from '../report/workDataset.ts'
import { ExportPanel } from './ExportPanel.tsx'
import { TextSize } from './TextSize.tsx'

export function WorkReport() {
  const [sp] = useSearchParams()
  const route = useMemo(() => readWork(sp), [sp])
  const { workshops, id: workshopId } = useActiveWorkshop(route.workshopId)
  const query = useWorkshopData(workshopId)
  const archive = useArchive()
  const data = useMemo(() => (query.data ? normalizeWorkshopData(query.data.data) : null), [query.data])
  const [generatedAt] = useState(() => new Date().toISOString())
  const [exportDoc, setExportDoc] = useState<ReportDoc | null>(null)
  const [scale, setScale] = useTextScale()
  const today = localToday()
  const timeZone = localTimeZone()

  const doc = useMemo(() => {
    if (!data) return null
    const ctx = { today, generatedAt, timeZone }
    const first = buildWorkReport(data, route.params, ctx)
    const earlier = earlierVersionsOf(archive.data, first.identity)
    return earlier.length > 0 ? buildWorkReport(data, route.params, { ...ctx, earlierVersions: earlier }) : first
  }, [data, route.params, today, generatedAt, timeZone, archive.data])

  const link = writeWork({ workshopId, params: route.params }).toString()

  if (workshops.isLoading || query.isLoading) return <Loading label="Building the report…" />
  if (workshops.isError) return <ErrorState error={workshops.error} onRetry={() => void workshops.refetch()} />
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />
  if (!doc || !data) return null

  return (
    <>
      <div className="doc-toolbar">
        <Link className="btn btn-secondary" to={`/work?${link}`}>
          ← Change the report
        </Link>
        <span className="spacer" />
        <TextSize scale={scale} onChange={setScale} />
        <button type="button" className="btn btn-primary" onClick={() => setExportDoc(doc)}>
          Check pages and send
        </button>
      </div>
      {query.data?.offline ? <OfflineNote savedAt={query.data.savedAt} /> : null}
      <ReportView doc={doc} scale={scale} />
      {exportDoc ? (
        <ExportPanel
          doc={exportDoc}
          generatedAt={generatedAt}
          route={`/work/report?${link}`}
          csv={() => workCsv(data, route.params, today, timeZone)}
          onClose={() => setExportDoc(null)}
        />
      ) : null}
    </>
  )
}
