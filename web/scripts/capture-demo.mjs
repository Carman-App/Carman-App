// Refreshes src/demo/data.json — the sample data the demo build runs on —
// from a running admin/ API, so the demo shows exactly what the real app
// would. Seed admin first (npm run seed, then npm run seed:reports).
//
// Usage: npm run demo:capture
// Reads API_PROXY_TARGET and VITE_DEV_ACCOUNT_ID from web/.env.
import { existsSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const envFile = fileURLToPath(new URL('../.env', import.meta.url))
if (existsSync(envFile)) process.loadEnvFile(envFile)

const base = `${(process.env.API_PROXY_TARGET || 'http://localhost:4000').replace(/\/+$/, '')}/api/v1/`
const account = process.env.VITE_DEV_ACCOUNT_ID
if (!account) throw new Error('VITE_DEV_ACCOUNT_ID is not set (see web/.env.example).')

async function get(path) {
  const res = await fetch(base + path, { headers: { 'x-carma-account-id': account } })
  if (!res.ok) throw new Error(`${path}: ${res.status} ${await res.text()}`)
  return (await res.json()).data
}

const responses = {}
const keep = async (path) => (responses[path] = await get(path))

await keep('account')
for (const garage of await keep('garages')) await keep(`garages/${garage.id}/report-data`)
for (const workshop of await keep('workshops')) await keep(`workshops/${workshop.id}/report-data`)

const capturedAt = new Date().toISOString()
// The demo's "today": periods like "last month" stay where the sample data is.
const today = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
const out = fileURLToPath(new URL('../src/demo/data.json', import.meta.url))
writeFileSync(out, `${JSON.stringify({ capturedAt, today, responses })}\n`)
console.log(`Saved ${Object.keys(responses).length} responses to src/demo/data.json (today = ${today}).`)
