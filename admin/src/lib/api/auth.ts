import "server-only";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { ProfileType } from "@/generated/prisma/enums";
import { verifyAccessToken } from "@/lib/auth/end-user";
import { recordActivity } from "@/lib/activity";
import { clientIp, enforceLimit, enforceLimits, LIMITS } from "@/lib/rate-limit";

export type RequestAccount = Prisma.AccountGetPayload<{ include: { user: true } }>;

/**
 * Identity resolution for the mobile-facing /api/v1/* routes.
 *
 * The caller proves who they are with `Authorization: Bearer <access token>`,
 * a short-lived token issued after Google/Apple sign-in (see
 * src/lib/auth/end-user.ts). Its signature and expiry are checked here.
 *
 * Development only: under `next dev` an `x-carma-account-id` header is
 * accepted so the app can run against a local server without OAuth
 * credentials (set ALLOW_DEV_ACCOUNT_HEADER=false to refuse it). In a
 * production build that header is ignored no matter what the env says.
 */
export function devAccountHeaderAllowed(): boolean {
  // `next dev` only (NODE_ENV=development): on by default so the app's demo
  // account works locally; ALLOW_DEV_ACCOUNT_HEADER=false turns it off.
  // Production builds (`next build` / `next start`) never accept it.
  return process.env.NODE_ENV === "development" && process.env.ALLOW_DEV_ACCOUNT_HEADER !== "false";
}

async function resolveAccountId(req: NextRequest): Promise<{ id: string; dev: boolean } | null> {
  const auth = req.headers.get("authorization");
  if (auth?.toLowerCase().startsWith("bearer ")) {
    const id = await verifyAccessToken(auth.slice(7).trim());
    return id ? { id, dev: false } : null;
  }
  if (devAccountHeaderAllowed()) {
    const id = req.headers.get("x-carma-account-id");
    return id ? { id, dev: true } : null;
  }
  return null;
}

/**
 * Development only: the app's test account (DEV_ACCOUNT_ID) is created empty
 * the first time it is used, so a fresh or wiped database works without
 * demo data. Set-up in the app then fills in the name, country and garage.
 */
async function provisionDevAccount(id: string): Promise<RequestAccount | null> {
  if (id !== (process.env.DEV_ACCOUNT_ID || "00000000-0000-4000-8000-000000000001")) return null;
  try {
    return await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({ data: { email: `dev-${id}@users.carma.invalid`, name: "" } });
      await tx.account.create({ data: { id, userId: user.id } });
      await tx.accountProfile.create({ data: { accountId: id, type: ProfileType.OWNER, isActive: true } });
      return tx.account.findUniqueOrThrow({ where: { id }, include: { user: true } });
    });
  } catch {
    // Two first requests raced: the other one created it.
    return prisma.account.findUnique({ where: { id }, include: { user: true } });
  }
}

export async function getRequestAccount(req: NextRequest): Promise<RequestAccount | null> {
  const resolved = await resolveAccountId(req);
  if (!resolved) return null;
  let account = await prisma.account.findUnique({ where: { id: resolved.id }, include: { user: true } });
  if (!account && resolved.dev) account = await provisionDevAccount(resolved.id);
  if (account) recordActivity(account.id);
  return account;
}

export class UnauthorizedError extends Error {
  constructor(message = "Authentication required.") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends Error {
  constructor(message = "Not allowed to access this resource.") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export async function requireAccount(req: NextRequest): Promise<RequestAccount> {
  const account = await getRequestAccount(req);
  if (!account) {
    await enforceLimit(LIMITS.anonymous, clientIp(req));
    throw new UnauthorizedError("Sign in to continue.");
  }
  await enforceLimits(req.method === "GET" || req.method === "HEAD" ? [LIMITS.api] : [LIMITS.api, LIMITS.write], account.id);
  // A suspended, deleted or merged account keeps no API access, even with a
  // still-valid access token.
  if (account.suspendedAt || account.deletedAt || account.mergedIntoAccountId) {
    throw new ForbiddenError("This account cannot be used. Contact Carma support.");
  }
  return account;
}
