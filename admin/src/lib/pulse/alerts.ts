import type { MetricSnapshot, PulseMetricKey } from "./metrics";
import { findOutOfBandMetrics } from "./metrics";

/**
 * PULSE-02's alert strip. Only "metric outside its normal band" has a real
 * data source today — the other four alert types the spec names (failed
 * payments, error spikes, stalled background jobs, an account reported)
 * have no underlying table/instrumentation in this codebase yet:
 *   - Failed payments: `Payment` has no status field (no FAILED state exists
 *     anywhere — only cash/mobile-money/etc. method + paidAt), so a payment
 *     attempt that failed leaves no row to query at all.
 *   - Error spikes: no error/exception logging exists (see metrics.ts).
 *   - Stalled background jobs: there is no background-job/queue system in
 *     this codebase — the `Job` model is a workshop repair job, not a
 *     queued task, so there is nothing to call "stalled" here.
 *   - Account reported: no reporting/flagging model exists (that's Trust,
 *     Phase Two).
 * These four are still rendered — as a clearly-labelled "not wired up yet"
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

export function buildAlerts(
  snapshots: Record<PulseMetricKey, MetricSnapshot>,
  linkForMetric: (key: PulseMetricKey) => string | undefined,
): Alert[] {
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
      id: "stalled_jobs",
      title: "Stalled background jobs",
      description: "Not wired up — there is no background-job/queue system to check for stalls.",
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
