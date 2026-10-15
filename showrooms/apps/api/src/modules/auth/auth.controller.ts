import type { Response } from "express";
import { forgotPasswordSchema, loginSchema, refreshSchema, registerSchema, resetPasswordSchema } from "@showrooms/shared";
import { requireAuth } from "../../middleware/auth";
import { handler, ok } from "../../utils/handler";
import { requestMeta } from "../audit/audit.service";
import { clearRefreshCookie, clientTypeOf, readRefreshToken, setRefreshCookie } from "./auth.cookies";
import * as authService from "./auth.service";

/** Web: refresh token goes into the HttpOnly cookie only. Mobile: returned in the body for SecureStore. */
function sendSession(res: Response, session: authService.IssuedSession, clientType: authService.ClientType, status = 200) {
  const { refreshToken, refreshTokenExpiresAt, ...rest } = session;
  if (clientType === "mobile") {
    return ok(res, { ...rest, refreshToken, refreshTokenExpiresAt: refreshTokenExpiresAt.toISOString() }, undefined, status);
  }
  setRefreshCookie(res, refreshToken, refreshTokenExpiresAt);
  return ok(res, rest, undefined, status);
}

export const register = handler({ body: registerSchema }, async ({ req, res, body }) => {
  const clientType = clientTypeOf(req);
  const session = await authService.register(body, { ...requestMeta(req), clientType });
  sendSession(res, session, clientType, 201);
});

export const login = handler({ body: loginSchema }, async ({ req, res, body }) => {
  const clientType = clientTypeOf(req);
  const session = await authService.login(body, { ...requestMeta(req), clientType });
  sendSession(res, session, clientType);
});

export const refresh = handler({ body: refreshSchema }, async ({ req, res, body }) => {
  const token = readRefreshToken(req, body.refreshToken);
  try {
    const session = await authService.refresh(token, { ...requestMeta(req), clientType: clientTypeOf(req) });
    sendSession(res, session, body.refreshToken ? "mobile" : "web");
  } catch (err) {
    if (!body.refreshToken) clearRefreshCookie(res);
    throw err;
  }
});

export const logout = handler({ body: refreshSchema }, async ({ req, res, body }) => {
  await authService.logout(readRefreshToken(req, body.refreshToken));
  clearRefreshCookie(res);
  res.status(204).end();
});

export const forgotPassword = handler({ body: forgotPasswordSchema }, async ({ req, res, body }) => {
  await authService.forgotPassword(body.email, requestMeta(req));
  ok(res, { message: "If an account exists for that email, we have sent a reset link." }, undefined, 202);
});

export const resetPassword = handler({ body: resetPasswordSchema }, async ({ req, res, body }) => {
  await authService.resetPassword(body, requestMeta(req));
  ok(res, { message: "Password updated. Sign in with your new password." });
});

export const me = handler({}, async ({ req, res }) => {
  ok(res, await authService.getCurrentUser(requireAuth(req).userId));
});

