/*
 * Carma Reports service worker (REACH-01). The app and everything a report
 * needs to be produced — the PDF engine, pdf.js, the fonts — are kept on the
 * device, so a report can be generated and read with no connection. Records
 * come from the app's own offline copy in IndexedDB (src/data/queries.ts):
 * this worker never touches /api.
 *
 * Built by the carma-service-worker plugin in vite.config.ts, which fills in
 * the version and the list of files from the build itself.
 */
const VERSION = __VERSION__
const PRECACHE = __PRECACHE__
const BASE = __BASE__
const CACHE = `carma-shell-${VERSION}`
const SHELL = `${BASE}index.html`
/** A slow connection shouldn't hold the app hostage: past this, the kept copy opens. */
const NAVIGATION_TIMEOUT_MS = 4000

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) {
        if (key.startsWith('carma-shell-') && key !== CACHE) await caches.delete(key)
      }
      // The first install takes over the open page, so files it loads later
      // (the PDF engine, on first export) come from the kept copy offline.
      // Updates don't skip waiting: a page keeps the version it started with.
      await self.clients.claim()
    })(),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin || url.pathname.startsWith(`${BASE}api/`)) return
  if (request.mode === 'navigate') event.respondWith(navigate(request))
  else if (PRECACHE.includes(url.pathname)) event.respondWith(fromCache(request))
})

/**
 * Network first, so a deploy is picked up as soon as there's a connection;
 * the kept shell when there isn't one, or when it's too slow to wait for.
 * The kept shell is only ever the one installed with this worker, so it
 * always matches the files kept alongside it.
 */
async function navigate(request) {
  try {
    return await Promise.race([
      fetch(request),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), NAVIGATION_TIMEOUT_MS)),
    ])
  } catch {
    const shell = await caches.match(SHELL, { cacheName: CACHE, ignoreVary: true })
    return shell ?? Response.error()
  }
}

/**
 * Kept files are named by their content, so the kept copy is always right.
 * Vary is ignored: servers often send "Vary: Origin", and a script loaded on
 * demand (the PDF engine) asks with different headers than the install did.
 */
async function fromCache(request) {
  const cached = await caches.match(request, { cacheName: CACHE, ignoreSearch: true, ignoreVary: true })
  if (cached) return cached
  const response = await fetch(request)
  if (response.ok) {
    const cache = await caches.open(CACHE)
    await cache.put(request, response.clone())
  }
  return response
}
