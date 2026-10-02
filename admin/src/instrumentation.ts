import * as Sentry from "@sentry/nextjs";
import { sentryOptions } from "@/lib/monitoring";

// Runs once per server instance (Node and Edge). Error monitoring starts only
// when SENTRY_DSN is set; see src/lib/monitoring.ts for what is sent.
export async function register() {
  const dsn = process.env.SENTRY_DSN;
  if (dsn) Sentry.init(sentryOptions(dsn));
}

// Errors thrown while rendering pages, in server actions and in route handlers.
export const onRequestError = Sentry.captureRequestError;
