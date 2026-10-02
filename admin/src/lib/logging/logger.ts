/**
 * Structured logging (section 14 of AGENTS.md's scalability pass).
 *
 * A deliberately lightweight approach — one consistent JSON shape per line
 * via console.log, no APM SDK (no error-monitoring credentials exist in
 * this codebase — see .env.example SENTRY_DSN). This is genuinely adequate
 * structured logging for a modular monolith: every hosting platform that
 * would run this app (Vercel, a container platform, etc.) already collects
 * stdout/stderr and lets you query/filter by the fields below. Upgrading to
 * a real APM/log-aggregation SaaS is an infrastructure decision (which
 * provider, whose credentials) this pass doesn't make unilaterally — see
 * SCALABILITY_AUDIT.md.
 *
 * NEVER log: passwords, session tokens/cookies, 2FA secrets/backup codes,
 * full document contents, or full financial detail beyond an amount/id
 * needed to correlate a request with a DB row. Every call site here passes
 * ids, not payloads.
 */

export type ApiLogEvent = {
  requestId: string;
  route: string;
  method: string;
  status: number;
  durationMs: number;
  accountId?: string | null;
  adminId?: string | null;
  error?: string;
};

export type JobLogEvent = {
  jobId: string;
  jobType: string;
  status: "started" | "completed" | "failed";
  durationMs?: number;
  attempts?: number;
  error?: string;
};

function emit(level: "info" | "warn" | "error", shape: Record<string, unknown>): void {
  const line = JSON.stringify({ ts: new Date().toISOString(), level, ...shape });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export function logApiRequest(event: ApiLogEvent): void {
  emit(event.status >= 500 ? "error" : event.status >= 400 ? "warn" : "info", {
    type: "api_request",
    ...event,
  });
}

export function logBackgroundJob(event: JobLogEvent): void {
  emit(event.status === "failed" ? "error" : "info", { type: "background_job", ...event });
}

let counter = 0;
/** Cheap, collision-resistant-enough request id for correlating log lines within one process. Not a UUID — doesn't need to be. */
export function newRequestId(): string {
  counter = (counter + 1) % 1_000_000;
  return `${Date.now().toString(36)}-${process.pid}-${counter}`;
}
