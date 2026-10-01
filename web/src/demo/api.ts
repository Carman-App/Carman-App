import { ApiError } from '../api/errors.ts'
import raw from './data.json?raw'

/**
 * The demo build (npm run build:demo) answers the app's API calls from a
 * snapshot of sample data instead of a server, so anyone can click through
 * a preview. Nothing is sent anywhere. The snapshot is admin/'s seeded demo
 * data, captured with npm run demo:capture.
 */

type Snapshot = { capturedAt: string; today: string; responses: Record<string, unknown> }

// Parsed on first use, not on load: nothing runs at the top of this module,
// so every other build can drop it, sample data and all.
let parsed: Snapshot | null = null
const snapshot = () => (parsed ??= JSON.parse(raw) as Snapshot)

/** The demo's "today" is the day the sample data was captured, so "last month" stays where the records are. */
export function demoToday(): string {
  return snapshot().today
}

export async function demoRequest<T>(path: string, method: 'GET' | 'POST'): Promise<T> {
  // A short pause, so loading states show as they would against a server.
  await new Promise((resolve) => setTimeout(resolve, 150))
  // Writes (recording that a report was generated) go nowhere in the demo.
  if (method === 'POST') return {} as T
  const key = path.replace(/^\//, '').split('?')[0] ?? ''
  const { responses } = snapshot()
  if (!(key in responses)) throw new ApiError(404, 'NOT_FOUND', 'This isn’t part of the sample data.')
  return structuredClone(responses[key]) as T
}
