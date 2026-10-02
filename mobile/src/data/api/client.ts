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
  constructor(message = 'Could not reach the Carma server. Check your connection and try again.', cause?: unknown) {
    super(message);
    this.name = 'NetworkError';
    this.cause = cause;
  }
}

function getBaseUrl(): string {
  const url = process.env.EXPO_PUBLIC_API_URL;
  if (!url) {
    throw new Error(
      'EXPO_PUBLIC_API_URL is not set. Copy mobile/.env.example to .env.local and fill it in — on a physical device or Android emulator, "localhost" would otherwise silently point at the wrong host.'
    );
  }
  return url;
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

/** Headers every API request carries (identity + JSON). */
export function apiHeaders(): Record<string, string> {
  return { 'Content-Type': 'application/json', 'x-carma-account-id': getCurrentAccountId() };
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const url = buildUrl(path, options.query);
  let res: Response;
  try {
    res = await fetch(url, {
      method: options.method ?? 'GET',
      headers: {
        'Content-Type': 'application/json',
        'x-carma-account-id': getCurrentAccountId(),
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch (cause) {
    throw new NetworkError(undefined, cause);
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

  return (json as { data: T }).data;
}

async function requestPaginated<T>(path: string, options: RequestOptions = {}): Promise<Paginated<T>> {
  const url = buildUrl(path, options.query);
  let res: Response;
  try {
    res = await fetch(url, {
      method: options.method ?? 'GET',
      headers: {
        'Content-Type': 'application/json',
        'x-carma-account-id': getCurrentAccountId(),
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch (cause) {
    throw new NetworkError(undefined, cause);
  }

  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    // see note above
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

  const body = json as { data: T[]; pagination: PaginationMeta };
  return { items: body.data, pagination: body.pagination };
}

export const api = {
  get: <T>(path: string, query?: RequestOptions['query']) => request<T>(path, { method: 'GET', query }),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
  getPaginated: <T>(path: string, query?: RequestOptions['query']) => requestPaginated<T>(path, { method: 'GET', query }),
};
