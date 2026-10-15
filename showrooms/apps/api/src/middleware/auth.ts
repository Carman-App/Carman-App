import type { RequestHandler } from "express";
import jwt from "jsonwebtoken";
import type { UserRole } from "@showrooms/shared";
import { env } from "../config/env";
import { User } from "../modules/users/user.model";
import { AppError } from "../utils/app-error";

export interface AuthContext {
  userId: string;
  role: UserRole;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AuthContext;
    }
  }
}

export const ACCESS_TOKEN_ISSUER = "showrooms-api";
export const ACCESS_TOKEN_AUDIENCE = "showrooms";

interface AccessTokenPayload extends jwt.JwtPayload {
  sub: string;
  role: UserRole;
}

export function signAccessToken(userId: string, role: UserRole): { token: string; expiresAt: Date } {
  const token = jwt.sign({ role }, env.JWT_ACCESS_SECRET, {
    subject: userId,
    expiresIn: env.ACCESS_TOKEN_TTL_SECONDS,
    issuer: ACCESS_TOKEN_ISSUER,
    audience: ACCESS_TOKEN_AUDIENCE,
    algorithm: "HS256",
  });
  return { token, expiresAt: new Date(Date.now() + env.ACCESS_TOKEN_TTL_SECONDS * 1000) };
}

function readBearer(header: string | undefined): string | null {
  if (!header) return null;
  const [scheme, value] = header.split(" ");
  return scheme?.toLowerCase() === "bearer" && value ? value : null;
}

async function resolveAuth(token: string): Promise<AuthContext> {
  let payload: AccessTokenPayload;
  try {
    payload = jwt.verify(token, env.JWT_ACCESS_SECRET, {
      issuer: ACCESS_TOKEN_ISSUER,
      audience: ACCESS_TOKEN_AUDIENCE,
      algorithms: ["HS256"],
    }) as AccessTokenPayload;
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) throw AppError.unauthenticated("Session expired", "TOKEN_EXPIRED");
    throw AppError.unauthenticated("Invalid session");
  }

  // Look the user up on every request so suspensions, role changes and
  // password resets take effect immediately rather than when the token expires.
  const user = await User.findById(payload.sub).select("role status passwordChangedAt").lean();
  if (!user) throw AppError.unauthenticated("Invalid session");
  if (user.status !== "ACTIVE") throw new AppError(403, "ACCOUNT_SUSPENDED", "This account is not active");
  if (user.passwordChangedAt && payload.iat && payload.iat * 1000 < user.passwordChangedAt.getTime() - 1000) {
    throw AppError.unauthenticated("Session expired", "TOKEN_EXPIRED");
  }
  // The role comes from the database, never from the token alone.
  return { userId: String(user._id), role: user.role };
}

/** Requires a valid access token. */
export const authenticate: RequestHandler = async (req, _res, next) => {
  const token = readBearer(req.headers.authorization);
  if (!token) throw AppError.unauthenticated();
  req.auth = await resolveAuth(token);
  next();
};

/** Attaches req.auth when a valid token is present; anonymous requests pass through. */
export const optionalAuth: RequestHandler = async (req, _res, next) => {
  const token = readBearer(req.headers.authorization);
  if (token) req.auth = await resolveAuth(token);
  next();
};

/** Must run after `authenticate`. */
export function authorize(...roles: UserRole[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.auth) throw AppError.unauthenticated();
    if (!roles.includes(req.auth.role)) throw AppError.forbidden();
    next();
  };
}

export function requireAuth(req: { auth?: AuthContext }): AuthContext {
  if (!req.auth) throw AppError.unauthenticated();
  return req.auth;
}
