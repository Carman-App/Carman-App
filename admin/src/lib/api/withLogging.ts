import type { NextRequest, NextResponse } from "next/server";
import { logApiRequest, newRequestId } from "@/lib/logging/logger";

/**
 * Structured request logging (AGENTS.md scalability pass, section 14) for
 * /api/v1/* route handlers — wraps a GET/POST/etc. handler so every call
 * logs one JSON line with requestId/route/method/status/durationMs/
 * accountId, without every route file duplicating that bookkeeping.
 *
 * Applied today to the routes this pass's load test exercises (section 21)
 * plus a couple of other high-traffic ones — rolling it out to every
 * remaining /api/v1/* route is a mechanical follow-up (wrap the export,
 * nothing else changes) once this pattern is confirmed to be the one worth
 * keeping; see SCALABILITY_AUDIT.md.
 *
 * Deliberately reads `accountId` off the raw header rather than re-querying
 * the database — this is a logging concern, not an authorization one, and
 * must never add its own DB round trip to the request path.
 */
type RouteHandler<Ctx> = (req: NextRequest, ctx: Ctx) => Promise<NextResponse>;

export function withApiLogging<Ctx = unknown>(route: string, handler: RouteHandler<Ctx>): RouteHandler<Ctx> {
  return async (req: NextRequest, ctx: Ctx) => {
    const requestId = newRequestId();
    const start = Date.now();
    const res = await handler(req, ctx);
    logApiRequest({
      requestId,
      route,
      method: req.method,
      status: res.status,
      durationMs: Date.now() - start,
      accountId: req.headers.get("x-carma-account-id"),
    });
    res.headers.set("x-request-id", requestId);
    return res;
  };
}
