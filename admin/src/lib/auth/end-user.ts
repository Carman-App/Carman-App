import "server-only";
import { createHash, randomBytes, randomUUID } from "crypto";
import { createRemoteJWKSet, jwtVerify, SignJWT, type JWTPayload } from "jose";
import { prisma } from "@/lib/prisma";
import { AuthProviderKind, ProfileType } from "@/generated/prisma/enums";

/**
 * End-user (owner / mechanic) sign-in with Google or Apple.
 *
 * 1. The app signs in natively and sends the provider's ID token here.
 * 2. The ID token is verified against the provider's published keys
 *    (signature, issuer, audience = our client ids, expiry).
 * 3. The person is found by the provider's stable subject, or linked to an
 *    existing user by a provider-verified email, or created.
 * 4. Carma issues its own session: a short-lived signed access token (sent
 *    as `Authorization: Bearer` on every API call, verified without a
 *    database hit) and a long-lived refresh token (stored hashed, rotated on
 *    every use; replaying a used one revokes the whole chain).
 */

export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
export const REFRESH_TOKEN_TTL_DAYS = 60;
const ISSUER = "carma";
const AUDIENCE = "carma-app";

export class SignInError extends Error {
  constructor(
    message: string,
    public readonly status: 400 | 401 | 403 | 503 = 401,
  ) {
    super(message);
    this.name = "SignInError";
  }
}

const list = (v: string | undefined) =>
  (v ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s && !s.startsWith("replace-with"));

/** Client ids an ID token may be issued to. Empty means that provider is off. */
export function providerAudiences() {
  return {
    google: list(process.env.GOOGLE_CLIENT_IDS ?? process.env.GOOGLE_CLIENT_ID),
    // The iOS bundle id for native Sign in with Apple, plus the Services ID if web sign-in is used.
    apple: list(process.env.APPLE_AUDIENCES ?? process.env.APPLE_CLIENT_ID),
  };
}

function accessSecret(): Uint8Array {
  const secret = process.env.AUTH_JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new SignInError("Sign-in is not configured on this server (AUTH_JWT_SECRET must be at least 32 characters).", 503);
  }
  return new TextEncoder().encode(secret);
}

const googleKeys = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));
const appleKeys = createRemoteJWKSet(new URL("https://appleid.apple.com/auth/keys"));

type VerifiedIdentity = {
  provider: AuthProviderKind;
  subject: string;
  email: string | null;
  emailVerified: boolean;
  name: string | null;
};

export async function verifyGoogleIdToken(idToken: string): Promise<VerifiedIdentity> {
  const audience = providerAudiences().google;
  if (audience.length === 0) throw new SignInError("Google sign-in is not configured on this server.", 503);
  let payload: JWTPayload & { email?: string; email_verified?: boolean | string; name?: string };
  try {
    ({ payload } = await jwtVerify(idToken, googleKeys, {
      issuer: ["https://accounts.google.com", "accounts.google.com"],
      audience,
    }));
  } catch {
    throw new SignInError("That Google sign-in could not be verified. Try again.");
  }
  if (!payload.sub) throw new SignInError("That Google sign-in had no account id.");
  return {
    provider: AuthProviderKind.GOOGLE,
    subject: payload.sub,
    email: payload.email?.toLowerCase() ?? null,
    emailVerified: payload.email_verified === true || payload.email_verified === "true",
    name: payload.name ?? null,
  };
}

export async function verifyAppleIdToken(identityToken: string, rawNonce: string): Promise<VerifiedIdentity> {
  const audience = providerAudiences().apple;
  if (audience.length === 0) throw new SignInError("Sign in with Apple is not configured on this server.", 503);
  let payload: JWTPayload & { email?: string; email_verified?: boolean | string; nonce?: string };
  try {
    ({ payload } = await jwtVerify(identityToken, appleKeys, { issuer: "https://appleid.apple.com", audience }));
  } catch {
    throw new SignInError("That Apple sign-in could not be verified. Try again.");
  }
  // The app sends Apple the SHA-256 of a one-time nonce and us the raw value,
  // so a captured token cannot be replayed from another device.
  const expected = createHash("sha256").update(rawNonce).digest("hex");
  if (!payload.nonce || payload.nonce !== expected) throw new SignInError("That Apple sign-in did not match this device. Try again.");
  if (!payload.sub) throw new SignInError("That Apple sign-in had no account id.");
  return {
    provider: AuthProviderKind.APPLE,
    subject: payload.sub,
    email: payload.email?.toLowerCase() ?? null,
    emailVerified: payload.email_verified === true || payload.email_verified === "true",
    name: null,
  };
}

const sha256 = (v: string) => createHash("sha256").update(v).digest("hex");

export type SessionTokens = {
  accessToken: string;
  accessTokenExpiresAt: string;
  refreshToken: string;
  refreshTokenExpiresAt: string;
};

async function issueSession(accountId: string, familyId: string, userAgent: string | null): Promise<SessionTokens> {
  const now = Math.floor(Date.now() / 1000);
  const accessToken = await new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(accountId)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt(now)
    .setExpirationTime(now + ACCESS_TOKEN_TTL_SECONDS)
    .setJti(randomUUID())
    .sign(accessSecret());

  const refreshToken = randomBytes(32).toString("base64url");
  const refreshExpires = new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 86_400_000);
  await prisma.endUserRefreshToken.create({
    data: { accountId, familyId, tokenHash: sha256(refreshToken), expiresAt: refreshExpires, userAgent: userAgent?.slice(0, 300) ?? null },
  });

  return {
    accessToken,
    accessTokenExpiresAt: new Date((now + ACCESS_TOKEN_TTL_SECONDS) * 1000).toISOString(),
    refreshToken,
    refreshTokenExpiresAt: refreshExpires.toISOString(),
  };
}

/** Verifies an access token and returns the account id it was issued to, or null. */
export async function verifyAccessToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, accessSecret(), { issuer: ISSUER, audience: AUDIENCE, algorithms: ["HS256"] });
    return payload.sub ?? null;
  } catch {
    return null;
  }
}

function assertUsable(account: { suspendedAt: Date | null; deletedAt: Date | null; mergedIntoAccountId: string | null }) {
  if (account.deletedAt) throw new SignInError("This account has been deleted. Contact Carma support if that was a mistake.", 403);
  if (account.suspendedAt) throw new SignInError("This account is suspended. Contact Carma support.", 403);
  if (account.mergedIntoAccountId) throw new SignInError("This account was merged into another. Sign in with the other one.", 403);
}

/**
 * Finds or creates the person behind a verified provider identity and
 * starts a session. Linking to an existing user by email only happens when
 * the provider says the email is verified.
 */
export async function signIn(identity: VerifiedIdentity, opts: { name?: string | null; userAgent: string | null }) {
  const existingIdentity = await prisma.authIdentity.findUnique({
    where: { provider_subject: { provider: identity.provider, subject: identity.subject } },
    include: { user: { include: { account: true } } },
  });

  let accountId: string;
  let isNew = false;

  if (existingIdentity?.user.account) {
    assertUsable(existingIdentity.user.account);
    accountId = existingIdentity.user.account.id;
    await prisma.authIdentity.update({ where: { id: existingIdentity.id }, data: { lastUsedAt: new Date(), email: identity.email ?? existingIdentity.email } });
  } else {
    const linkable =
      identity.email && identity.emailVerified
        ? await prisma.user.findUnique({ where: { email: identity.email }, include: { account: true } })
        : null;

    if (linkable?.account) {
      assertUsable(linkable.account);
      accountId = linkable.account.id;
      await prisma.authIdentity.create({ data: { userId: linkable.id, provider: identity.provider, subject: identity.subject, email: identity.email } });
    } else {
      // Apple can withhold the email, and an unverified email may already
      // belong to someone else; a unique placeholder keeps User.email's
      // uniqueness without inventing a reachable address or taking theirs.
      const placeholder = `${identity.provider.toLowerCase()}-${identity.subject}@users.carma.invalid`;
      const taken = identity.email ? await prisma.user.findUnique({ where: { email: identity.email }, select: { id: true } }) : null;
      const email = identity.email && !taken ? identity.email : placeholder;
      const name = (opts.name ?? identity.name ?? "").trim() || email.split("@")[0];
      const created = await prisma.$transaction(async (tx) => {
        const user = await tx.user.create({ data: { email, name } });
        const account = await tx.account.create({ data: { userId: user.id } });
        await tx.accountProfile.create({ data: { accountId: account.id, type: ProfileType.OWNER, isActive: true } });
        await tx.authIdentity.create({ data: { userId: user.id, provider: identity.provider, subject: identity.subject, email: identity.email } });
        return account;
      });
      accountId = created.id;
      isNew = true;
    }
  }

  const tokens = await issueSession(accountId, randomUUID(), opts.userAgent);
  return { accountId, isNew, ...tokens };
}

/** Exchanges a refresh token for a new pair. A reused token revokes its whole chain. */
export async function refreshSession(refreshToken: string, userAgent: string | null): Promise<SessionTokens> {
  const row = await prisma.endUserRefreshToken.findUnique({ where: { tokenHash: sha256(refreshToken) }, include: { account: true } });
  if (!row) throw new SignInError("Your session has ended. Sign in again.");

  if (row.usedAt || row.revokedAt) {
    // Presented twice: someone else may hold a copy. End every session in this chain.
    await prisma.endUserRefreshToken.updateMany({
      where: { familyId: row.familyId, revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: row.usedAt ? "reuse_detected" : "revoked" },
    });
    throw new SignInError("Your session has ended. Sign in again.");
  }
  if (row.expiresAt < new Date()) throw new SignInError("Your session has ended. Sign in again.");
  assertUsable(row.account);

  // Mark used only if nobody else did first (two parallel refreshes).
  const claimed = await prisma.endUserRefreshToken.updateMany({ where: { id: row.id, usedAt: null }, data: { usedAt: new Date() } });
  if (claimed.count === 0) throw new SignInError("Your session has ended. Sign in again.");

  return issueSession(row.accountId, row.familyId, userAgent);
}

/** Ends the session chain a refresh token belongs to (sign out of this device). */
export async function signOut(refreshToken: string): Promise<void> {
  const row = await prisma.endUserRefreshToken.findUnique({ where: { tokenHash: sha256(refreshToken) } });
  if (!row) return;
  await prisma.endUserRefreshToken.updateMany({
    where: { familyId: row.familyId, revokedAt: null },
    data: { revokedAt: new Date(), revokedReason: "signed_out" },
  });
}
