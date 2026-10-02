import type { MetricSnapshot, PulseMetricKey } from "./metrics";
import { findOutOfBandMetrics } from "./metrics";
import { getStalledJobs } from "@/lib/queue/queue";

/**
 * PULSE-02's alert strip. Two of the five named alert types have a real data
 * source today — "metric outside its normal band" (always did) and "stalled
 * background jobs" (since the scalability pass added a real Postgres-backed
 * BackgroundJob queue — see src/lib/queue/queue.ts's getStalledJobs). The
 * other three still have no underlying table/instrumentation in this
 * codebase:
 *   - Failed payments: `Payment` has no status field (no FAILED state exists
 *     anywhere — only cash/mobile-money/etc. method + paidAt), so a payment
 *     attempt that failed leaves no row to query at all.
 *   - Error spikes: no error/exception logging exists (see metrics.ts).
 *   - Account reported: no reporting/flagging model exists (that's Trust,
 *     Phase Two).
 * These three are still rendered — as a clearly-labelled "not wired up yet"
 * row each — so the alert strip's shape is correct and each one is a single
 * line of real work away once its data source exists, per the brief's
 * instruction to "build the alert-strip UI and wire what you can."
 */
export type Alert = {
  id: string;
  severity: "real" | "not_wired";
  title: string;
  description: string;
  href?: string;
};

export async function buildAlerts(
  snapshots: Record<PulseMetricKey, MetricSnapshot>,
  linkForMetric: (key: PulseMetricKey) => string | undefined,
): Promise<Alert[]> {
  const alerts: Alert[] = [];

  for (const band of findOutOfBandMetrics(snapshots)) {
    const dir = band.deviationPercent > 0 ? "above" : "below";
    alerts.push({
      id: `band:${band.key}`,
      severity: "real",
      title: `${band.label} is ${Math.abs(Math.round(band.deviationPercent))}% ${dir} its 7-day average`,
      description: `Today: ${Math.round(band.today).toLocaleString()} · 7-day average: ${band.avg.toFixed(1)}`,
      href: linkForMetric(band.key),
    });
  }

  const stalled = await getStalledJobs();
  if (stalled.length > 0) {
    const oldest = stalled[0];
    const minutesStalled = Math.round((Date.now() - oldest.since.getTime()) / 60000);
    alerts.push({
      id: "stalled_jobs",
      severity: "real",
      title: `${stalled.length} background job${stalled.length === 1 ? "" : "s"} stalled`,
      description: `Oldest: "${oldest.type}" (${oldest.status.toLowerCase()}, attempt ${oldest.attempts}/${oldest.maxAttempts}) — waiting ${minutesStalled}+ min with no progress. Check the queue worker (npm run queue:worker) is running.`,
    });
  }

  const notWired: { id: string; title: string; description: string }[] = [
    {
      id: "failed_payments",
      title: "Failed payments",
      description: "Not wired up — Payment has no failure status in this schema yet (Money is Phase Two).",
    },
    {
      id: "error_spikes",
      title: "Error spikes",
      description: "Not wired up — no error/exception logging exists in this codebase yet.",
    },
    {
      id: "account_reported",
      title: "Account reported",
      description: "Not wired up — no reporting/flagging model exists yet (Trust is Phase Two).",
    },
  ];
  for (const n of notWired) {
    alerts.push({ id: n.id, severity: "not_wired", title: n.title, description: n.description });
  }

  return alerts;
}
