import "server-only";
import { createHmac, timingSafeEqual } from "crypto";
import { cookies, headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { AdminRole } from "@/generated/prisma/enums";

// Hand-rolled signed session cookie for the internal admin panel (see
// AGENTS.md task brief — deliberately not NextAuth, to avoid version-
// compatibility risk on this very new Next.js release).
//
// Cookie value shape: base64url(payload-json) + "." + base64url(hmac-sha256)
// The payload is not encrypted, only signed. It carries only the
// AdminSession row's id (plus a short display cache) — the row itself is
// the source of truth for validity, so a session can be force-revoked
// (AUD-05) even though the cookie's signature still checks out. This costs
// one indexed lookup per request, acceptable for an internal admin console.

export const SESSION_COOKIE_NAME = "carma_admin_session";
export const PENDING_2FA_COOKIE_NAME = "carma_admin_pending_2fa";
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours — "sessions expiring" (AUD-05)
const PENDING_2FA_TTL_MS = 5 * 60 * 1000; // 5 minutes to complete the 2FA step after password check

type SessionPayload = {
  sessionId: string;
  adminId: string;
  email: string;
  name: string;
  role: AdminRole;
  exp: number; // epoch ms
};

type Pending2faPayload = {
  adminId: string;
  email: string;
  exp: number;
};

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error(
      "SESSION_SECRET is not set. Add it to your .env file (see .env.example).",
    );
  }
  return secret;
}

function base64url(input: Buffer | string): string {
  const buf = typeof input === "string" ? Buffer.from(input) : input;
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function base64urlDecode(input: string): Buffer {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/");
  const padding = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
  return Buffer.from(padded + padding, "base64");
}

function sign(payload: string): string {
  return base64url(createHmac("sha256", getSecret()).update(payload).digest());
}

function encode<T>(payload: T): string {
  const json = JSON.stringify(payload);
  const encodedPayload = base64url(json);
  const signature = sign(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

function decode<T extends { exp: number }>(token: string | undefined | null): T | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [encodedPayload, signature] = parts;

  const expectedSignature = sign(encodedPayload);
  const a = Buffer.from(signature);
  const b = Buffer.from(expectedSignature);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return null;
  }

  try {
    const payload = JSON.parse(base64urlDecode(encodedPayload).toString("utf8")) as T;
    if (typeof payload.exp !== "number" || payload.exp < Date.now()) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export const encodeSession = encode<SessionPayload>;
export const decodeSession = decode<SessionPayload>;

/** Best-effort caller IP from standard proxy headers (dev/prod reverse-proxy friendly). */
export async function getRequestIp(): Promise<string | null> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return h.get("x-real-ip") ?? null;
}

export async function getRequestUserAgent(): Promise<string | null> {
  const h = await headers();
  return h.get("user-agent");
}

/**
 * Creates the DB-backed AdminSession row and the signed cookie pointing at
 * it. Flags isNewLocation when this admin's prior sessions never used this
 * IP — surfaced as a banner in the dashboard shell (AUD-05 "alert on
 * sign-in from a new location").
 */
export async function createSession(admin: {
  id: string;
  email: string;
  name: string;
  role: AdminRole;
}): Promise<void> {
  const ip = await getRequestIp();
  const userAgent = await getRequestUserAgent();

  let isNewLocation = false;
  if (ip) {
    const priorFromSameIp = await prisma.adminSession.findFirst({
      where: { adminUserId: admin.id, ipAddress: ip },
      select: { id: true },
    });
    const hasAnyPriorSession = await prisma.adminSession.findFirst({
      where: { adminUserId: admin.id },
      select: { id: true },
    });
    isNewLocation = Boolean(hasAnyPriorSession) && !priorFromSameIp;
  }

  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  const session = await prisma.adminSession.create({
    data: {
      adminUserId: admin.id,
      ipAddress: ip,
      userAgent,
      isNewLocation,
      expiresAt,
    },
  });

  const token = encodeSession({
    sessionId: session.id,
    adminId: admin.id,
    email: admin.email,
    name: admin.name,
    role: admin.role,
    exp: expiresAt.getTime(),
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export type CurrentSession = SessionPayload & { isNewLocation: boolean };

/**
 * Resolves the current signed-in admin. Verifies the cookie signature AND
 * that the backing AdminSession row is still live (not revoked/expired) —
 * this is what makes "force sign-out" actually take effect immediately
 * rather than waiting for the 12h cookie TTL.
 */
export async function getSession(): Promise<CurrentSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const payload = decodeSession(token);
  if (!payload) return null;

  const row = await prisma.adminSession.findUnique({ where: { id: payload.sessionId } });
  if (!row || row.revokedAt || row.expiresAt < new Date()) {
    return null;
  }

  // Cheap liveness refresh; not awaited-critical if it races, so fire and forget.
  void prisma.adminSession
    .update({ where: { id: row.id }, data: { lastSeenAt: new Date() } })
    .catch(() => {});

  return { ...payload, isNewLocation: row.isNewLocation };
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const payload = decodeSession(token);
  if (payload) {
    await prisma.adminSession
      .update({
        where: { id: payload.sessionId },
        data: { revokedAt: new Date(), revokedReason: "logout" },
      })
      .catch(() => {});
  }
  cookieStore.delete(SESSION_COOKIE_NAME);
}

// --- Pending 2FA step (between password check and a real session) ---------

export async function createPending2fa(admin: { id: string; email: string }): Promise<void> {
  const exp = Date.now() + PENDING_2FA_TTL_MS;
  const token = encode<Pending2faPayload>({ adminId: admin.id, email: admin.email, exp });
  const cookieStore = await cookies();
  cookieStore.set(PENDING_2FA_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(exp),
  });
}

export async function getPending2fa(): Promise<Pending2faPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(PENDING_2FA_COOKIE_NAME)?.value;
  return decode<Pending2faPayload>(token);
}

export async function clearPending2fa(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(PENDING_2FA_COOKIE_NAME);
}
