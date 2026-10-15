import { randomUUID } from "node:crypto";
import type { AuthSession, PublicUser } from "@showrooms/shared";
import type { z } from "zod";
import type { loginSchema, registerSchema, resetPasswordSchema } from "@showrooms/shared";
import { env } from "../../config/env";
import { logger } from "../../config/logger";
import { signAccessToken } from "../../middleware/auth";
import { services } from "../../services";
import { passwordResetEmail } from "../../services/email/templates";
import { AppError } from "../../utils/app-error";
import { generateOpaqueToken, hashToken } from "../../utils/tokens";
import { audit, type RequestMeta } from "../audit/audit.service";
import { User, type UserDocument } from "../users/user.model";
import { burnPasswordCheck, hashPassword, verifyPassword } from "./password";
import { PasswordResetToken } from "./password-reset-token.model";
import { RefreshToken } from "./refresh-token.model";

export type ClientType = "web" | "mobile";

export interface IssuedSession extends Omit<AuthSession, "refreshToken"> {
  refreshToken: string;
  refreshTokenExpiresAt: Date;
}

interface SessionContext extends RequestMeta {
  clientType: ClientType;
}

export function toPublicUser(user: UserDocument): PublicUser {
  return user.toJSON() as unknown as PublicUser;
}

async function issueSession(user: UserDocument, ctx: SessionContext, familyId: string = randomUUID()): Promise<IssuedSession> {
  const access = signAccessToken(String(user._id), user.role);
  const refreshToken = generateOpaqueToken();
  const refreshTokenExpiresAt = new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 86_400_000);

  await RefreshToken.create({
    userId: user._id,
    tokenHash: hashToken(refreshToken),
    familyId,
    expiresAt: refreshTokenExpiresAt,
    clientType: ctx.clientType,
    userAgent: ctx.userAgent,
    ip: ctx.ip,
  });

  return {
    user: toPublicUser(user),
    accessToken: access.token,
    accessTokenExpiresAt: access.expiresAt.toISOString(),
    refreshToken,
    refreshTokenExpiresAt,
  };
}

export async function register(input: z.output<typeof registerSchema>, ctx: SessionContext): Promise<IssuedSession> {
  if (await User.exists({ email: input.email })) {
    throw AppError.conflict("An account with this email already exists", "EMAIL_TAKEN");
  }
  if (input.phone && (await User.exists({ phone: input.phone }))) {
    throw AppError.conflict("An account with this phone number already exists", "PHONE_TAKEN");
  }

  // The role was validated against SELF_ASSIGNABLE_ROLES, so ADMIN can never get here.
  const user = await User.create({
    name: input.name,
    email: input.email,
    phone: input.phone,
    role: input.role,
    passwordHash: await hashPassword(input.password),
  });

  await audit({ action: "auth.register", actorId: String(user._id), actorRole: user.role, entityType: "User", entityId: String(user._id) }, ctx);
  return issueSession(user, ctx);
}

export async function login(input: z.output<typeof loginSchema>, ctx: SessionContext): Promise<IssuedSession> {
  const user = await User.findOne({ email: input.email }).select("+passwordHash");
  if (!user) {
    await burnPasswordCheck(input.password);
    throw new AppError(401, "INVALID_CREDENTIALS", "Email or password is incorrect");
  }
  if (!(await verifyPassword(input.password, user.passwordHash))) {
    await audit({ action: "auth.login_failed", actorId: String(user._id), entityType: "User", entityId: String(user._id) }, ctx);
    throw new AppError(401, "INVALID_CREDENTIALS", "Email or password is incorrect");
  }
  if (user.status !== "ACTIVE") {
    throw new AppError(403, "ACCOUNT_SUSPENDED", "This account has been suspended. Contact support for help.");
  }

  user.lastLoginAt = new Date();
  await user.save();
  await audit({ action: "auth.login", actorId: String(user._id), actorRole: user.role }, ctx);
  return issueSession(user, ctx);
}

async function revokeFamily(familyId: string, reason: "LOGOUT" | "REUSE_DETECTED") {
  await RefreshToken.updateMany({ familyId, revokedAt: null }, { $set: { revokedAt: new Date(), revokedReason: reason } });
}

export async function refresh(rawToken: string | undefined, ctx: SessionContext): Promise<IssuedSession> {
  if (!rawToken) throw AppError.unauthenticated("Sign in to continue");

  const tokenHash = hashToken(rawToken);
  const stored = await RefreshToken.findOne({ tokenHash });
  if (!stored) throw AppError.unauthenticated("Invalid session");

  if (stored.revokedAt) {
    if (stored.revokedReason === "ROTATED") {
      // A rotated token came back: someone else holds a copy. Kill every token in its family.
      await revokeFamily(stored.familyId, "REUSE_DETECTED");
      await audit({ action: "auth.refresh_reuse_detected", actorId: String(stored.userId), metadata: { familyId: stored.familyId } }, ctx);
      logger.warn({ userId: String(stored.userId), familyId: stored.familyId }, "Refresh token reuse detected");
    }
    throw AppError.unauthenticated("Session ended. Please sign in again.");
  }
  if (stored.expiresAt.getTime() <= Date.now()) throw AppError.unauthenticated("Session expired. Please sign in again.");

  // Claim the token atomically so two concurrent refreshes cannot both succeed.
  const claimed = await RefreshToken.findOneAndUpdate(
    { _id: stored._id, revokedAt: null },
    { $set: { revokedAt: new Date(), revokedReason: "ROTATED" } },
  );
  if (!claimed) {
    await revokeFamily(stored.familyId, "REUSE_DETECTED");
    throw AppError.unauthenticated("Session ended. Please sign in again.");
  }

  const user = await User.findById(stored.userId);
  if (!user || user.status !== "ACTIVE") {
    await revokeFamily(stored.familyId, "LOGOUT");
    throw new AppError(403, "ACCOUNT_SUSPENDED", "This account is not active");
  }

  return issueSession(user, { ...ctx, clientType: stored.clientType }, stored.familyId);
}

export async function logout(rawToken: string | undefined): Promise<void> {
  if (!rawToken) return;
  const stored = await RefreshToken.findOne({ tokenHash: hashToken(rawToken) }).select("familyId");
  if (stored) await revokeFamily(stored.familyId, "LOGOUT");
}

/** Always resolves the same way, whether or not the email exists, to avoid account enumeration. */
export async function forgotPassword(email: string, meta: RequestMeta): Promise<void> {
  const user = await User.findOne({ email, status: "ACTIVE" });
  if (!user) return;

  await PasswordResetToken.updateMany({ userId: user._id, usedAt: null }, { $set: { usedAt: new Date() } });
  const token = generateOpaqueToken(32);
  await PasswordResetToken.create({
    userId: user._id,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + env.PASSWORD_RESET_TTL_MINUTES * 60_000),
  });

  const link = `${env.WEB_URL}/reset-password?token=${encodeURIComponent(token)}`;
  try {
    await services().email.send({ to: user.email, ...passwordResetEmail(user.name, link, env.PASSWORD_RESET_TTL_MINUTES) });
  } catch (err) {
    logger.error({ err, userId: String(user._id) }, "Password reset email failed");
  }
  await audit({ action: "auth.password_reset_requested", actorId: String(user._id) }, meta);
}

export async function resetPassword(input: z.output<typeof resetPasswordSchema>, meta: RequestMeta): Promise<void> {
  const now = new Date();
  const claimed = await PasswordResetToken.findOneAndUpdate(
    { tokenHash: hashToken(input.token), usedAt: null, expiresAt: { $gt: now } },
    { $set: { usedAt: now } },
  );
  if (!claimed) throw AppError.badRequest("This reset link is invalid or has expired. Request a new one.");

  const user = await User.findById(claimed.userId);
  if (!user) throw AppError.badRequest("This reset link is invalid or has expired. Request a new one.");

  user.passwordHash = await hashPassword(input.password);
  user.passwordChangedAt = now;
  await user.save();

  // Sign out every device: whoever prompted the reset may not be the only one with access.
  await RefreshToken.updateMany({ userId: user._id, revokedAt: null }, { $set: { revokedAt: now, revokedReason: "PASSWORD_RESET" } });
  await audit({ action: "auth.password_reset", actorId: String(user._id), actorRole: user.role }, meta);
}

export async function getCurrentUser(userId: string): Promise<PublicUser> {
  const user = await User.findById(userId);
  if (!user) throw AppError.notFound("User");
  return toPublicUser(user);
}
