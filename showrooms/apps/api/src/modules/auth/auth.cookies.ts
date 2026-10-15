import type { CookieOptions, Request, Response } from "express";
import { env, isProduction } from "../../config/env";
import { AppError } from "../../utils/app-error";
import type { ClientType } from "./auth.service";

export const REFRESH_COOKIE = "sr_refresh";
/** Scope the cookie to auth routes so it is never sent with ordinary API calls. */
const COOKIE_PATH = "/api/v1/auth";

function cookieOptions(expires?: Date): CookieOptions {
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: COOKIE_PATH,
    domain: env.COOKIE_DOMAIN,
    expires,
  };
}

/** Native apps identify themselves and keep the refresh token in SecureStore instead of a cookie. */
export function clientTypeOf(req: Request): ClientType {
  return req.get("x-client-type") === "mobile" ? "mobile" : "web";
}

export function setRefreshCookie(res: Response, token: string, expires: Date) {
  res.cookie(REFRESH_COOKIE, token, cookieOptions(expires));
}

export function clearRefreshCookie(res: Response) {
  res.clearCookie(REFRESH_COOKIE, cookieOptions());
}

/**
 * Body token (mobile) wins over the cookie (web). Cookie-authenticated calls must
 * carry X-Requested-With: a custom header forces a CORS preflight, which only
 * allowlisted origins pass, so another site cannot replay the cookie (CSRF).
 */
export function readRefreshToken(req: Request, bodyToken: string | undefined): string | undefined {
  if (bodyToken) return bodyToken;
  const cookieToken: unknown = req.cookies?.[REFRESH_COOKIE];
  if (typeof cookieToken !== "string") return undefined;
  if (req.get("x-requested-with") !== "showrooms") {
    throw AppError.forbidden("Missing X-Requested-With header");
  }
  return cookieToken;
}
