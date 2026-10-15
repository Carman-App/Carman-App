import type { RequestHandler } from "express";
import { rateLimit, ipKeyGenerator } from "express-rate-limit";

const message = { error: { code: "RATE_LIMITED", message: "Too many requests. Please wait and try again." } };

/**
 * In-memory store: fine for a single instance. Behind several API instances,
 * swap in a shared store (e.g. rate-limit-redis) so limits are global.
 */
export function createRateLimiters(enabled: boolean) {
  const passthrough: RequestHandler = (_req, _res, next) => next();
  if (!enabled) return { general: passthrough, auth: passthrough, credential: passthrough };

  return {
    general: rateLimit({ windowMs: 15 * 60_000, limit: 600, standardHeaders: "draft-8", legacyHeaders: false, message }),
    /** Token refresh, logout, me. */
    auth: rateLimit({ windowMs: 15 * 60_000, limit: 120, standardHeaders: "draft-8", legacyHeaders: false, message }),
    /** Login, register, password reset: keyed by IP + email to slow credential stuffing. */
    credential: rateLimit({
      windowMs: 15 * 60_000,
      limit: 10,
      standardHeaders: "draft-8",
      legacyHeaders: false,
      message,
      keyGenerator: (req) => {
        const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
        return `${ipKeyGenerator(req.ip ?? "")}:${email}`;
      },
    }),
  };
}
