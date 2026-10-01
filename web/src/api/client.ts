/**
 * Thin typed fetch wrapper around admin/'s /api/v1/* surface — the same
 * contract the mobile app uses (see mobile/src/data/api/client.ts).
 *
 * Response envelope: { data: T } on success, { error: { code, message } }
 * on failure with the HTTP status set.
 */

import { demoRequest } from '../demo/api.ts'
import { ApiError, NetworkError } from './errors.ts'

export { ApiError, NetworkError }

/**
 * SINGLE SWAP POINT for identity. There is no end-user auth yet, so every
 * request carries a fixed dev account id from env (must match admin/.env's
 * DEV_ACCOUNT_ID). When real sign-in lands, derive the caller from the
 * session here — no other file should read the env var.
 */
export function getCurrentAccountId(): string {
  const id = import.meta.env.VITE_DEV_ACCOUNT_ID as string | undefined
  if (!id) {
    throw new ApiError(
      401,
      'NO_IDENTITY',
      'VITE_DEV_ACCOUNT_ID is not set. Copy web/.env.example to web/.env and fill it in (it must match admin/.env DEV_ACCOUNT_ID).',
    )
  }
  return id
}

function baseUrl(): string {
  const configured = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/+$/, '')
  return configured ? `${configured}/api/v1/` : '/api/v1/'
}

async function request<T>(path: string, init: { method?: 'GET' | 'POST'; body?: unknown; signal?: AbortSignal } = {}): Promise<T> {
  // The demo build answers from its sample data; this branch is dropped from every other build.
  if (import.meta.env.MODE === 'demo') return demoRequest<T>(path, init.method ?? 'GET')
  let res: Response
  try {
    res = await fetch(`${baseUrl()}${path.replace(/^\//, '')}`, {
      method: init.method ?? 'GET',
      headers: {
        'Content-Type': 'application/json',
        'x-carma-account-id': getCurrentAccountId(),
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      signal: init.signal,
    })
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === 'AbortError') throw cause
    throw new NetworkError()
  }

  let json: unknown = null
  try {
    json = await res.json()
  } catch {
    // non-JSON body (proxy error page) — handled by the status check below
  }

  if (!res.ok) {
    const error = (json as { error?: { code?: string; message?: string } } | null)?.error
    // A dev proxy with nothing listening answers 5xx with no JSON envelope.
    if (!error && res.status >= 500) throw new NetworkError()
    throw new ApiError(res.status, error?.code ?? 'UNKNOWN_ERROR', error?.message ?? `Request failed (${res.status}).`)
  }
  return (json as { data: T }).data
}

export const api = {
  get: <T>(path: string, signal?: AbortSignal) => request<T>(path, { signal }),
  post: <T>(path: string, body: unknown) => request<T>(path, { method: 'POST', body }),
}
