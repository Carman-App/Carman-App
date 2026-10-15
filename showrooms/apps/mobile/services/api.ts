import type { ApiErrorBody, AuthSession } from "@showrooms/shared";
import { API_URL } from "@/constants/config";
import { tokenStorage } from "./token-storage";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }

  fieldErrors(): Record<string, string> {
    if (!Array.isArray(this.details)) return {};
    return Object.fromEntries((this.details as { path: string; message: string }[]).map((d) => [d.path, d.message]));
  }
}

export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  return "Can't reach Showrooms. Check your connection and try again.";
}

type MobileSession = AuthSession & { refreshToken: string };
type Listener = (session: AuthSession | null) => void;

let accessToken: string | null = null;
let refreshing: Promise<AuthSession | null> | null = null;
const listeners = new Set<Listener>();

export function onSessionChange(fn: Listener) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

async function applySession(session: MobileSession | null) {
  accessToken = session?.accessToken ?? null;
  if (session) await tokenStorage.set(session.refreshToken);
  else await tokenStorage.clear();
  listeners.forEach((fn) => fn(session));
}

const baseHeaders = { "Content-Type": "application/json", "X-Client-Type": "mobile" };

/**
 * Rotates the refresh token. Single-flight: the API treats a reused refresh
 * token as theft and revokes the session, so concurrent 401s must share one call.
 */
export function refreshSession(): Promise<AuthSession | null> {
  refreshing ??= (async () => {
    try {
      const refreshToken = await tokenStorage.get();
      if (!refreshToken) return null;
      const res = await fetch(`${API_URL}/auth/refresh`, { method: "POST", headers: baseHeaders, body: JSON.stringify({ refreshToken }) });
      if (!res.ok) {
        // Network errors keep the stored token; only an explicit rejection signs out.
        if (res.status === 401 || res.status === 403) await applySession(null);
        return null;
      }
      const session = ((await res.json()) as { data: MobileSession }).data;
      await applySession(session);
      return session;
    } catch {
      return null;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

export interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  signal?: AbortSignal;
  headers?: Record<string, string>;
}

async function raw(path: string, opts: RequestOptions, retry: boolean): Promise<Response> {
  const res = await fetch(`${API_URL}${path}`, {
    method: opts.method ?? "GET",
    headers: { ...baseHeaders, ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}), ...opts.headers },
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    signal: opts.signal,
  });
  if (res.status === 401 && retry && !path.startsWith("/auth/")) {
    if (await refreshSession()) return raw(path, opts, false);
  }
  return res;
}

async function toError(res: Response) {
  const body = (await res.json().catch(() => null)) as ApiErrorBody | null;
  return new ApiError(res.status, body?.error.code ?? "INTERNAL_ERROR", body?.error.message ?? `Request failed (${res.status})`, body?.error.details);
}

export async function api<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const res = await raw(path, opts, true);
  if (res.status === 204) return undefined as T;
  if (!res.ok) throw await toError(res);
  return ((await res.json()) as { data: T }).data;
}

export interface Paged<T, M = Record<string, unknown>> {
  data: T;
  meta: { page: number; limit: number; total: number; totalPages: number } & M;
}

export async function apiPaged<T, M = Record<string, unknown>>(path: string, opts: RequestOptions = {}): Promise<Paged<T, M>> {
  const res = await raw(path, opts, true);
  if (!res.ok) throw await toError(res);
  return res.json();
}

export async function signIn(path: "/auth/login" | "/auth/register", body: unknown): Promise<AuthSession> {
  const session = await api<MobileSession>(path, { method: "POST", body });
  await applySession(session);
  return session;
}

export async function signOut(): Promise<void> {
  const refreshToken = await tokenStorage.get();
  try {
    if (refreshToken) await fetch(`${API_URL}/auth/logout`, { method: "POST", headers: baseHeaders, body: JSON.stringify({ refreshToken }) });
  } finally {
    await applySession(null);
  }
}

/** For tests only. */
export function __resetSessionForTests() {
  accessToken = null;
  refreshing = null;
  listeners.clear();
}
