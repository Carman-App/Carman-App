import { useQuery } from '@tanstack/react-query'
import { useSyncExternalStore } from 'react'
import { api, NetworkError } from '../api/client.ts'
import type { RawAccount, RawGarage, RawGarageReportData, RawWorkshop, RawWorkshopReportData } from '../api/types.ts'
import { idbGet, idbPut, STORES } from './idb.ts'

/**
 * Server data for the report builders. Every snapshot is kept on the device
 * after a successful fetch; when the server can't be reached the last copy
 * is used instead and flagged as offline, so a report can still be
 * produced without a connection (REACH-01). Sharing waits for a signal;
 * producing the document does not.
 */

export type Loaded<T> = { data: T; offline: boolean; savedAt: string }

type Snapshot<T> = { key: string; data: T; savedAt: string }

async function withSnapshot<T>(key: string, fetcher: () => Promise<T>): Promise<Loaded<T>> {
  try {
    const data = await fetcher()
    const savedAt = new Date().toISOString()
    void idbPut<Snapshot<T>>(STORES.snapshots, { key, data, savedAt })
    return { data, offline: false, savedAt }
  } catch (error) {
    if (error instanceof NetworkError) {
      const cached = await idbGet<Snapshot<T>>(STORES.snapshots, key)
      if (cached) return { data: cached.data, offline: true, savedAt: cached.savedAt }
    }
    throw error
  }
}

export function useAccount() {
  return useQuery({ queryKey: ['account'], queryFn: () => withSnapshot('account', () => api.get<RawAccount>('account')) })
}

export function useGarages() {
  return useQuery({ queryKey: ['garages'], queryFn: () => withSnapshot('garages', () => api.get<RawGarage[]>('garages')) })
}

export function useGarageData(garageId: string | null) {
  return useQuery({
    queryKey: ['garage-data', garageId],
    queryFn: () => withSnapshot(`garage:${garageId}`, () => api.get<RawGarageReportData>(`garages/${garageId}/report-data`)),
    enabled: !!garageId,
  })
}

export function useWorkshops() {
  return useQuery({ queryKey: ['workshops'], queryFn: () => withSnapshot('workshops', () => api.get<RawWorkshop[]>('workshops')) })
}

export function useWorkshopData(workshopId: string | null) {
  return useQuery({
    queryKey: ['workshop-data', workshopId],
    queryFn: () => withSnapshot(`workshop:${workshopId}`, () => api.get<RawWorkshopReportData>(`workshops/${workshopId}/report-data`)),
    enabled: !!workshopId,
  })
}

function subscribeOnline(cb: () => void) {
  window.addEventListener('online', cb)
  window.addEventListener('offline', cb)
  return () => {
    window.removeEventListener('online', cb)
    window.removeEventListener('offline', cb)
  }
}

export function useOnline(): boolean {
  return useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true)
}

/** Today as "YYYY-MM-DD" in the reader's time zone. */
export function localToday(): string {
  return new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
}

export function localTimeZone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone
  } catch {
    return undefined
  }
}
