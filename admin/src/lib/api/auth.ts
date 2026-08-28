import "server-only";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";

export type RequestAccount = Prisma.AccountGetPayload<{ include: { user: true } }>;

/**
 * Identity resolution for the mobile-facing /api/v1/* routes.
 *
 * Real end-user authentication (Apple/Google OAuth) is a later phase — see
 * src/lib/auth/provider.ts. Until it lands there is no session token to
 * verify, so this reads an `x-carma-account-id` header as a development
 * stand-in for "the caller is this Account". This keeps the authorization
 * *chain* below (account -> role -> membership -> resource -> permission ->
 * plan limit) real and testable today; only the very first step is a stub.
 *
 * TODO(end-user-auth phase): replace the header read with verifying a real
 * session/JWT from the AuthProvider and swap this function's body — no
 * other route code should need to change.
 */
export async function getRequestAccount(req: NextRequest): Promise<RequestAccount | null> {
  const accountId = req.headers.get("x-carma-account-id");
  if (!accountId) return null;

  const account = await prisma.account.findUnique({ where: { id: accountId }, include: { user: true } });

  // Active-user proxy signal for Pulse (see AGENTS.md "Definitions" — mobile
  // has no session/open-app analytics yet, so "API request activity tied to
  // an account" is the closest observable stand-in). Fire-and-forget: never
  // let bookkeeping slow down or fail a real request.
  if (account) {
    void prisma.account
      .update({ where: { id: account.id }, data: { lastApiRequestAt: new Date() } })
      .catch(() => {});
  }

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
    throw new UnauthorizedError(
      "Missing or unknown x-carma-account-id header (end-user auth not implemented yet).",
    );
  }
  return account;
}
