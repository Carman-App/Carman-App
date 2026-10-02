import * as Sentry from "@sentry/nextjs";

/**
 * Error monitoring (Sentry). Off unless SENTRY_DSN is set. Personal data is
 * kept out: the SDK collects no user data by default, and auth headers, cookies and request bodies are
 * stripped before an event leaves the server.
 */

const SENSITIVE_HEADERS = ["authorization", "cookie", "x-carma-account-id"];

export function sentryOptions(dsn: string): Sentry.NodeOptions {
  return {
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
    release: process.env.SENTRY_RELEASE,
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0.05),
    beforeSend(event) {
      if (event.request) {
        delete event.request.cookies;
        delete event.request.data;
        const headers = event.request.headers as Record<string, string> | undefined;
        if (headers) for (const h of Object.keys(headers)) if (SENSITIVE_HEADERS.includes(h.toLowerCase())) delete headers[h];
      }
      return event;
    },
  };
}

/** Reports an unexpected error with optional context. Safe to call when Sentry is off. */
export function reportError(error: unknown, context?: Record<string, unknown>): void {
  if (!process.env.SENTRY_DSN) return;
  Sentry.captureException(error, context ? { extra: context } : undefined);
}
