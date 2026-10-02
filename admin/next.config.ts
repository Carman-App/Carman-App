import type { NextConfig } from "next";

// Sent on every response. The console renders its own pages only, so it can
// refuse framing and sniffing outright; HSTS takes effect once served over HTTPS.
const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Standalone output: a self-contained server for the Docker image (see Dockerfile).
  output: "standalone",
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // API responses carry personal data: never cache them in shared caches.
      { source: "/api/:path*", headers: [{ key: "Cache-Control", value: "no-store" }] },
    ];
  },
  experimental: {
    // Enables next/navigation's forbidden()/unauthorized() + forbidden.tsx —
    // used to enforce AdminRole checks server-side (never client-hidden-only)
    // on Accounts and other role-gated surfaces. See src/lib/auth/rbac.ts.
    authInterrupts: true,
  },
};

export default nextConfig;
