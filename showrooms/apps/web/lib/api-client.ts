"use client";

import type { AuthSession } from "@showrooms/shared";
import { ApiError } from "./api-error";
import { API_URL } from "./utils";

/**
 * Browser API client. The access token lives only in memory (never
 * localStorage); the refresh token is an HttpOnly cookie the API scopes to
 * /api/v1/auth. A 401 TOKEN_EXPIRED triggers one refresh and one retry.
 */
let accessToken: string | null = null;
let refreshing: Promise<AuthSession | null> | null = null;
const listeners = new Set<(session: AuthSession | null) => void>();

export function onSessionChange(fn: (session: AuthSession | null) => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function setSession(session: AuthSession | null) {
  accessToken = session?.accessToken ?? null;
  listeners.forEach((fn) => fn(session));
}

export function hasAccessToken() {
  return accessToken !== null;
}

/** Single-flight: concurrent 401s share one refresh, because the API treats a reused refresh token as theft. */
export function refreshSession(): Promise<AuthSession | null> {
  refreshing ??= (async () => {
    try {
      const res = await fetch(`${API_URL}/auth/refresh`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", "X-Requested-With": "showrooms" },
        body: "{}",
      });
      if (!res.ok) {
        setSession(null);
        return null;
      }
      const session = ((await res.json()) as { data: AuthSession }).data;
      setSession(session);
      return session;
    } catch {
      return null;
    } finally {
      setTimeout(() => (refreshing = null), 0);
    }
  })();
  return refreshing;
}

export interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  signal?: AbortSignal;
  headers?: Record<string, string>;
}

export interface Paged<T, M = Record<string, unknown>> {
  data: T;
  meta: { page: number; limit: number; total: number; totalPages: number } & M;
}

async function raw(path: string, opts: RequestOptions, retry: boolean): Promise<Response> {
  const headers: Record<string, string> = { ...opts.headers };
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  const res = await fetch(`${API_URL}${path}`, {
    method: opts.method ?? "GET",
    headers,
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    signal: opts.signal,
    credentials: path.startsWith("/auth/") ? "include" : "omit",
  });
  if (res.status === 401 && retry && path !== "/auth/refresh") {
    const body = (await res.clone().json().catch(() => null)) as { error?: { code?: string } } | null;
    if (body?.error?.code === "TOKEN_EXPIRED" || (body?.error?.code === "UNAUTHENTICATED" && !accessToken)) {
      if (await refreshSession()) return raw(path, opts, false);
    }
  }
  return res;
}

/** Returns `{ data, meta }`. */
export async function apiPaged<T, M = Record<string, unknown>>(path: string, opts: RequestOptions = {}): Promise<Paged<T, M>> {
  const res = await raw(path, opts, true);
  if (!res.ok) throw await ApiError.from(res);
  return res.json();
}

/** Returns `data`. */
export async function api<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const res = await raw(path, opts, true);
  if (res.status === 204) return undefined as T;
  if (!res.ok) throw await ApiError.from(res);
  return ((await res.json()) as { data: T }).data;
}

export async function login(email: string, password: string): Promise<AuthSession> {
  const session = await api<AuthSession>("/auth/login", { method: "POST", body: { email, password } });
  setSession(session);
  return session;
}

export async function logout(): Promise<void> {
  try {
    await fetch(`${API_URL}/auth/logout`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json", "X-Requested-With": "showrooms" }, body: "{}" });
  } finally {
    setSession(null);
  }
}
