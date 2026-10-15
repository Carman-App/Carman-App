import { Router, type RequestHandler } from "express";
import { forgotPasswordSchema, loginSchema, refreshSchema, registerSchema, resetPasswordSchema } from "@showrooms/shared";
import { describeRoute } from "../../docs/openapi";
import { authenticate } from "../../middleware/auth";
import * as controller from "./auth.controller";

export function authRoutes(limits: { auth: RequestHandler; credential: RequestHandler }): Router {
  const router = Router();
  router.post("/register", limits.credential, controller.register);
  router.post("/login", limits.credential, controller.login);
  router.post("/refresh", limits.auth, controller.refresh);
  router.post("/logout", limits.auth, controller.logout);
  router.post("/forgot-password", limits.credential, controller.forgotPassword);
  router.post("/reset-password", limits.credential, controller.resetPassword);
  router.get("/me", limits.auth, authenticate, controller.me);
  return router;
}

const tag = "Auth";
describeRoute({ method: "post", path: "/auth/register", tag, summary: "Create a buyer, broker or dealer account", body: registerSchema, responses: { 201: "Signed in", 409: "Email or phone already used", 422: "Validation error" } });
describeRoute({ method: "post", path: "/auth/login", tag, summary: "Sign in with email and password", body: loginSchema, responses: { 200: "Signed in", 401: "Wrong email or password", 403: "Account suspended" } });
describeRoute({ method: "post", path: "/auth/refresh", tag, summary: "Rotate the refresh token and get a new access token", body: refreshSchema, responses: { 200: "New session", 401: "Session invalid, expired or reused" } });
describeRoute({ method: "post", path: "/auth/logout", tag, summary: "Revoke this session", body: refreshSchema, responses: { 204: "Signed out" } });
describeRoute({ method: "post", path: "/auth/forgot-password", tag, summary: "Email a password reset link", body: forgotPasswordSchema, responses: { 202: "Accepted (same response whether or not the email exists)" } });
describeRoute({ method: "post", path: "/auth/reset-password", tag, summary: "Set a new password with a reset token", body: resetPasswordSchema, responses: { 200: "Password changed; all sessions revoked", 400: "Token invalid or expired" } });
describeRoute({ method: "get", path: "/auth/me", tag, summary: "Current user", auth: true, responses: { 200: "Current user", 401: "Not signed in" } });
