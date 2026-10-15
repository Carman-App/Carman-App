import type { NextConfig } from "next";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";
const apiOrigin = new URL(apiUrl).origin;
const apiHost = new URL(apiUrl);
// In local development the API serves uploaded media itself (MEDIA_PROVIDER=local).
const localApi = ["localhost", "127.0.0.1"].includes(apiHost.hostname);

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self)" },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  // The shared package ships TypeScript source.
  transpilePackages: ["@showrooms/shared"],
  poweredByHeader: false,
  // The Docker image builds a self-contained server; local `next start` uses the normal output.
  output: process.env.NEXT_OUTPUT === "standalone" ? "standalone" : undefined,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "res.cloudinary.com" },
      // Development placeholders only.
      { protocol: "https", hostname: "placehold.co" },
      ...(localApi ? [{ protocol: apiHost.protocol.replace(":", "") as "http" | "https", hostname: apiHost.hostname, port: apiHost.port, pathname: "/media/**" }] : []),
    ],
    // Only ever true when the API itself runs on localhost.
    dangerouslyAllowLocalIP: localApi,
    dangerouslyAllowSVG: false,
    formats: ["image/avif", "image/webp"],
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // Dashboards and admin are per-user: never cache them in shared caches.
      { source: "/dashboard/:path*", headers: [{ key: "Cache-Control", value: "private, no-store" }] },
      { source: "/admin/:path*", headers: [{ key: "Cache-Control", value: "private, no-store" }, { key: "X-Robots-Tag", value: "noindex" }] },
    ];
  },
  env: {
    NEXT_PUBLIC_API_ORIGIN: apiOrigin,
  },
};

export default nextConfig;
