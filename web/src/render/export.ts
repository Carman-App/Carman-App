import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { api } from '../api/client.ts'
import { idbAll, idbDelete, idbPut, STORES } from '../data/idb.ts'
import type { ReportDoc } from '../report/model.ts'

/**
 * Getting a document out of the app: download, the system share sheet,
 * and the on-device archive that keeps every generated file byte-for-byte
 * so the same document can be sent twice (SYS-06, TAX-05).
 */

export type ArchiveFormat = 'pdf' | 'csv' | 'png'

export type ArchiveEntry = {
  id: string
  kind: ReportDoc['kind']
  format: ArchiveFormat
  title: string
  subject: string
  periodLabel: string
  periodRange: string
  generatedAt: string
  filename: string
  size: number
  pages?: number
  identity: string
  fingerprint: string
  /** In-app link that rebuilds the same report from today's records. */
  route: string
  recordCount: number
  headline: string
  blob: Blob
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

export function canShareFiles(files: File[]): boolean {
  try {
    return typeof navigator.canShare === 'function' && navigator.canShare({ files })
  } catch {
    return false
  }
}

export async function shareFiles(files: File[], title: string, text: string): Promise<'shared' | 'cancelled' | 'failed'> {
  try {
    await navigator.share({ files, title, text })
    return 'shared'
  } catch (error) {
    return error instanceof DOMException && error.name === 'AbortError' ? 'cancelled' : 'failed'
  }
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export function useArchive() {
  return useQuery({
    queryKey: ['archive'],
    queryFn: async () => (await idbAll<ArchiveEntry>(STORES.archive)).sort((a, b) => (a.generatedAt < b.generatedAt ? 1 : -1)),
  })
}

/** Earlier generations of the same report (SYS-05), newest first. */
export function earlierVersionsOf(entries: ArchiveEntry[] | undefined, identity: string) {
  return (entries ?? [])
    .filter((e) => e.identity === identity && e.format === 'pdf')
    .map((e) => ({ generatedAt: e.generatedAt, fingerprint: e.fingerprint }))
}

export function useArchiveActions() {
  const qc = useQueryClient()
  const save = useCallback(
    async (entry: Omit<ArchiveEntry, 'id'>) => {
      const ok = await idbPut<ArchiveEntry>(STORES.archive, { ...entry, id: `${entry.generatedAt}-${entry.format}-${entry.fingerprint}` })
      await qc.invalidateQueries({ queryKey: ['archive'] })
      return ok
    },
    [qc],
  )
  const remove = useCallback(
    async (id: string) => {
      await idbDelete(STORES.archive, id)
      await qc.invalidateQueries({ queryKey: ['archive'] })
    },
    [qc],
  )
  return { save, remove }
}

/**
 * Tell the server a report was produced (admin's export counts, DATA-04).
 * Best-effort: generating and sending a document never waits on it.
 */
export function recordGeneration(input: { scope: 'VEHICLE' | 'GARAGE'; scopeId: string; periodLabel: string; format: 'PDF' | 'CSV' }) {
  void api.post('reports', { ...input, periodLabel: input.periodLabel.slice(0, 100) }).catch(() => undefined)
}
