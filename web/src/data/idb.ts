/**
 * Minimal promise wrapper over IndexedDB for the two things this app keeps
 * on the device: the last snapshot of each garage/workshop (so a report can
 * still be produced offline, REACH-01) and the archive of generated files
 * (SYS-06). Every call fails soft — private windows and blocked storage
 * simply behave as "nothing stored".
 */

const DB_NAME = 'carma-reports'
const DB_VERSION = 1
export const STORES = { snapshots: 'snapshots', archive: 'archive' } as const
type StoreName = (typeof STORES)[keyof typeof STORES]

let dbPromise: Promise<IDBDatabase> | null = null

function open(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not available.'))
      return
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORES.snapshots)) db.createObjectStore(STORES.snapshots, { keyPath: 'key' })
      if (!db.objectStoreNames.contains(STORES.archive)) db.createObjectStore(STORES.archive, { keyPath: 'id' })
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  dbPromise.catch(() => {
    dbPromise = null
  })
  return dbPromise
}

function run<T>(store: StoreName, mode: IDBTransactionMode, op: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(store, mode)
        const req = op(tx.objectStore(store))
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error)
      }),
  )
}

export async function idbGet<T>(store: StoreName, key: string): Promise<T | undefined> {
  try {
    return (await run(store, 'readonly', (s) => s.get(key))) as T | undefined
  } catch {
    return undefined
  }
}

export async function idbAll<T>(store: StoreName): Promise<T[]> {
  try {
    return (await run(store, 'readonly', (s) => s.getAll())) as T[]
  } catch {
    return []
  }
}

export async function idbPut<T>(store: StoreName, value: T): Promise<boolean> {
  try {
    await run(store, 'readwrite', (s) => s.put(value))
    return true
  } catch {
    return false
  }
}

export async function idbDelete(store: StoreName, key: string): Promise<void> {
  try {
    await run(store, 'readwrite', (s) => s.delete(key))
  } catch {
    // nothing to remove
  }
}
