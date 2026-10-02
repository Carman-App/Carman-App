/**
 * Thin typed fetch wrapper around the admin/ app's `/api/v1/*` surface.
 *
 * Every request carries an `x-carma-account-id` header — the interim
 * identity mechanism documented in admin/src/lib/api/auth.ts. There is no
 * real end-user auth yet (Apple/Google OAuth is a later phase), so
 * `getCurrentAccountId()` below is the SINGLE place that decides "who is
 * calling". Swapping in real auth later means changing the body of that one
 * function (e.g. reading a session token and deriving the account id from
 * it) — no other call site in the app should need to change.
 *
 * Response envelope (see admin/src/lib/api/response.ts):
 *   success:            { data: T }
 *   success (paginated): { data: T[], pagination: { page, pageSize, total, totalPages } }
 *   error:              { error: { code, message, details? } }, with the
 *                       HTTP status already set correctly (401/403/404/409/402/422/500).
 */

import Constants from 'expo-constants';

import { clearSession, getSession, loadSession, saveSession, type Session } from '@/data/auth/session';
import { Platform } from 'react-native';

/** Same shape admin/src/lib/api/response.ts emits for paginated list endpoints. */
export type PaginationMeta = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type Paginated<T> = {
  items: T[];
  pagination: PaginationMeta;
};

/**
 * Thrown for any non-2xx response. React Query's `isError`/`error` surface
 * this naturally — screens should render `error.message` (or branch on
 * `status`/`code` for special-cased UI, e.g. 404 -> "not found" vs a generic
 * retry banner) rather than swallowing it.
 */
export class ApiError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

/**
 * Thrown when the request never reached the server at all (dev server down,
 * device offline, DNS failure, ...) — distinct from ApiError so screens can
 * tell "the server said no" apart from "we couldn't reach the server".
 */
export class NetworkError extends Error {
  cause?: unknown;
  constructor(message = `Could not reach the Carma server at ${serverAddress()}. Check the admin server is running and this device is on the same network.`, cause?: unknown) {
    super(message);
    this.name = 'NetworkError';
    this.cause = cause;
  }
}

/**
 * On a phone or emulator, "localhost" is the device itself, not the computer
 * running the admin server. In development the computer's address is known:
 * it is the host Expo served the bundle from (Constants.expoConfig.hostUri,
 * e.g. "192.168.0.12:8081"). A localhost API URL is pointed there instead,
 * keeping its port. Web and real hostnames are left untouched.
 */
function resolveLocalhost(url: string): string {
  if (Platform.OS === 'web') return url;
  const parsed = new URL(url);
  if (parsed.hostname !== 'localhost' && parsed.hostname !== '127.0.0.1') return url;
  const devHost = Constants.expoConfig?.hostUri?.split(':')[0];
  if (!devHost || devHost === 'localhost' || devHost === '127.0.0.1') {
    // Android emulator without a LAN host: 10.0.2.2 is the computer.
    if (Platform.OS === 'android') parsed.hostname = '10.0.2.2';
    return parsed.toString().replace(/\/$/, '');
  }
  parsed.hostname = devHost;
  return parsed.toString().replace(/\/$/, '');
}

let baseUrl: string | null = null;

function getBaseUrl(): string {
  if (baseUrl) return baseUrl;
  const url = process.env.EXPO_PUBLIC_API_URL;
  if (!url) {
    throw new Error('EXPO_PUBLIC_API_URL is not set. Copy mobile/.env.example to .env.local and fill it in.');
  }
  baseUrl = resolveLocalhost(url);
  return baseUrl;
}

/** The server address the app is actually using, for error messages. */
export function serverAddress(): string {
  try {
    return getBaseUrl();
  } catch {
    return 'no server set';
  }
}

/**
 * SINGLE SWAP POINT for identity. Today: a fixed dev/demo account id from
 * env (see .env.example — must match admin/.env's DEV_ACCOUNT_ID). Later:
 * derive this from a real signed-in session (e.g. a decoded JWT / auth
 * context) instead of an env var. Every other file in the app should keep
 * calling this function rather than reading the env var directly.
 */
export function getCurrentAccountId(): string {
  const id = process.env.EXPO_PUBLIC_DEV_ACCOUNT_ID;
  if (!id) {
    throw new Error(
      'EXPO_PUBLIC_DEV_ACCOUNT_ID is not set. Copy mobile/.env.example to .env.local and fill it in (see admin/.env DEV_ACCOUNT_ID).'
    );
  }
  return id;
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined>;
};

function buildUrl(path: string, query?: RequestOptions['query']): string {
  const url = new URL(path.replace(/^\//, ''), `${getBaseUrl()}/api/v1/`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

/** Absolute URL for an /api/v1 path, for callers that need fetch directly (streaming). */
export function apiUrl(path: string, query?: RequestOptions['query']): string {
  return buildUrl(path, query);
}

// ---------------------------------------------------------------------------
// Identity
// ---------------------------------------------------------------------------

/** Called when the session can no longer be refreshed, so the app can show Welcome. */
let onSignedOut: (() => void) | null = null;
export function setSignedOutHandler(fn: () => void) {
  onSignedOut = fn;
}

let refreshing: Promise<Session | null> | null = null;

/** Trades the refresh token for a new pair. One refresh at a time; concurrent callers share it. */
function refreshAccessToken(): Promise<Session | null> {
  if (refreshing) return refreshing;
  const session = getSession();
  if (!session) return Promise.resolve(null);
  refreshing = (async () => {
    try {
      const res = await fetch(buildUrl('auth/refresh'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: session.refreshToken }),
      });
      if (!res.ok) {
        // 401/403: the session is over. Anything else (5xx, 429): keep it and let the call fail.
        if (res.status === 401 || res.status === 403) {
          await clearSession();
          onSignedOut?.();
        }
        return null;
      }
      const next = ((await res.json()) as { data: Session }).data;
      await saveSession(next);
      return next;
    } catch {
      return null;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

const REFRESH_EARLY_MS = 60_000;

/**
 * Headers every API request carries. With a session: `Authorization: Bearer`,
 * refreshed shortly before it expires. Without one, in development only, the
 * fixed dev account id (the server ignores it in production).
 */
export async function apiHeaders(): Promise<Record<string, string>> {
  let session = getSession() ?? (await loadSession());
  if (session && new Date(session.accessTokenExpiresAt).getTime() - Date.now() < REFRESH_EARLY_MS) {
    session = (await refreshAccessToken()) ?? getSession();
  }
  if (session) return { 'Content-Type': 'application/json', Authorization: `Bearer ${session.accessToken}` };
  if (__DEV__ && process.env.EXPO_PUBLIC_DEV_ACCOUNT_ID) {
    return { 'Content-Type': 'application/json', 'x-carma-account-id': getCurrentAccountId() };
  }
  return { 'Content-Type': 'application/json' };
}

async function send(path: string, options: RequestOptions, retried = false): Promise<unknown> {
  const url = buildUrl(path, options.query);
  let res: Response;
  try {
    res = await fetch(url, {
      method: options.method ?? 'GET',
      headers: await apiHeaders(),
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch (cause) {
    throw new NetworkError(undefined, cause);
  }

  // An access token can expire or be revoked between the check and the call: refresh once and retry.
  if (res.status === 401 && !retried && getSession()) {
    const next = await refreshAccessToken();
    if (next) return send(path, options, true);
  }

  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    // Non-JSON body (e.g. a 502 from a proxy) — fall through to the
    // status-based error below with no `details`.
  }

  if (!res.ok) {
    const errorBody = (json as { error?: { code?: string; message?: string; details?: unknown } } | null)?.error;
    throw new ApiError(
      res.status,
      errorBody?.code ?? 'UNKNOWN_ERROR',
      errorBody?.message ?? `Request failed with status ${res.status}.`,
      errorBody?.details
    );
  }
  return json;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  return ((await send(path, options)) as { data: T }).data;
}

async function requestPaginated<T>(path: string, options: RequestOptions = {}): Promise<Paginated<T>> {
  const body = (await send(path, options)) as { data: T[]; pagination: PaginationMeta };
  return { items: body.data, pagination: body.pagination };
}

export const api = {
  get: <T>(path: string, query?: RequestOptions['query']) => request<T>(path, { method: 'GET', query }),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
  getPaginated: <T>(path: string, query?: RequestOptions['query']) => requestPaginated<T>(path, { method: 'GET', query }),
};
