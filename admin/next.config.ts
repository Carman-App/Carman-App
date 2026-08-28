import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Enables next/navigation's forbidden()/unauthorized() + forbidden.tsx —
    // used to enforce AdminRole checks server-side (never client-hidden-only)
    // on Accounts and other role-gated surfaces. See src/lib/auth/rbac.ts.
    authInterrupts: true,
  },
};

export default nextConfig;
