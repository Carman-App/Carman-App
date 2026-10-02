import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE_NAME, decodeSession } from "@/lib/auth/session";

// Next.js 16 renamed Middleware to Proxy (see AGENTS.md / node_modules/next/dist/docs).
// This guards the admin dashboard: everything except /login, /api/*, and
// Next's own internals requires a valid signed session cookie.
//
// This is an optimistic check only (cookie presence + signature, no DB
// call) per the Next.js auth guide — it exists to redirect unauthenticated
// visitors away from the dashboard shell quickly, not as the only line of
// defense. Individual server components/actions still verify what they need.

// CORS for /api/v1/* — the mobile app runs on a different origin/port
// during development (Expo/Metro dev server, simulator, physical device on
// the LAN) and end-user auth is still the x-carma-account-id header stub
// (see src/lib/api/auth.ts), not a browser cookie, so this is a
// dev-permissive policy: reflect back whichever Origin sent the request,
// unless CORS_ALLOWED_ORIGINS (comma-separated) is set to lock it down for
// a real deployment. See node_modules/next/dist/docs .../proxy.md#cors —
// this is the documented single mechanism for CORS across all API routes,
// so add origins here rather than per-route headers.
const explicitAllowedOrigins = (process.env.CORS_ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const CORS_ALLOW_METHODS = "GET, POST, PATCH, DELETE, OPTIONS";
const CORS_ALLOW_HEADERS =
  process.env.NODE_ENV === "production" ? "Content-Type, Authorization" : "Content-Type, Authorization, x-carma-account-id";

// In production an origin must be listed in CORS_ALLOWED_ORIGINS; nothing is
// reflected by default. The native apps send no Origin header and are not
// affected — CORS only governs browsers.
function originAllowed(origin: string): boolean {
  if (explicitAllowedOrigins.length > 0) return explicitAllowedOrigins.includes(origin);
  return process.env.NODE_ENV !== "production";
}

function withCors(request: NextRequest, response: NextResponse): NextResponse {
  const origin = request.headers.get("origin");
  if (!origin) return response;
  if (!originAllowed(origin)) return response;

  response.headers.set("Access-Control-Allow-Origin", origin);
  response.headers.set("Access-Control-Allow-Credentials", "true");
  response.headers.set("Access-Control-Allow-Methods", CORS_ALLOW_METHODS);
  response.headers.set("Access-Control-Allow-Headers", CORS_ALLOW_HEADERS);
  response.headers.append("Vary", "Origin");
  return response;
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/api/")) {
    // Preflight requests never reach the route handler's own logic, so they
    // must be answered here.
    if (request.method === "OPTIONS") {
      return withCors(request, new NextResponse(null, { status: 204 }));
    }
    return withCors(request, NextResponse.next());
  }

  const isPublic =
    pathname === "/login" ||
    pathname === "/login/verify" ||
    pathname === "/login/setup-2fa" ||
    pathname.startsWith("/legal/"); // privacy policy, terms, account deletion: public
  if (isPublic) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = decodeSession(token);

  if (!session) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
