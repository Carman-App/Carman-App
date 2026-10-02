import * as Sentry from "@sentry/nextjs";

// Browser errors in the admin console, when NEXT_PUBLIC_SENTRY_DSN is set.
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
if (dsn) {
  Sentry.init({ dsn, tracesSampleRate: 0.05 });
}

export const onRouterTransitionStart = dsn ? Sentry.captureRouterTransitionStart : undefined;
