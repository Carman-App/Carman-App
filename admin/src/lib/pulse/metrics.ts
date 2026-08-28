import { prisma } from "@/lib/prisma";

/**
 * Pulse's fixed reference timezone (AGENTS.md PULSE-04: "a completed
 * 'yesterday' column ... in a fixed timezone stated on the page"). Nairobi
 * (East Africa Time, UTC+3) is used because Carma is Kenya-first (see
 * AGENTS.md / Region.KE default) and EAT has no DST, so the +3h offset is
 * always correct — no timezone database needed for this one fixed offset.
 */
export const PULSE_TIMEZONE_LABEL = "East Africa Time (UTC+3)";
const EAT_OFFSET_MS = 3 * 60 * 60 * 1000;

/** The UTC instant corresponding to EAT midnight, `daysAgo` days before today (0 = today). */
function eatMidnightUtc(daysAgo: number): Date {
  const nowEat = new Date(Date.now() + EAT_OFFSET_MS);
  const y = nowEat.getUTCFullYear();
  const m = nowEat.getUTCMonth();
  const d = nowEat.getUTCDate();
  return new Date(Date.UTC(y, m, d - daysAgo, 0, 0, 0, 0) - EAT_OFFSET_MS);
}

export type DateRange = { start: Date; end: Date };

/** The [start, end) UTC instants bounding one EAT calendar day, `daysAgo` days before today. */
export function eatDay(daysAgo: number): DateRange {
  return { start: eatMidnightUtc(daysAgo), end: eatMidnightUtc(daysAgo - 1) };
}

/** Monday-based weekday index (0 = Monday .. 6 = Sunday) for "today" in EAT. */
export function eatWeekdayIndex(): number {
  const nowEat = new Date(Date.now() + EAT_OFFSET_MS);
  return (nowEat.getUTCDay() + 6) % 7;
}

// ---------------------------------------------------------------------------
// The defined metric list (AGENTS.md section 07 / PULSE-01). Exactly these
// seven — PULSE-06 lets an admin pin 5 of them to the top.
// ---------------------------------------------------------------------------

export const PULSE_METRIC_KEYS = [
  "signups",
  "active_users",
  "records_logged",
  "jobs_opened",
  "invoices_raised",
  "money_collected",
  "errors",
] as const;

export type PulseMetricKey = (typeof PULSE_METRIC_KEYS)[number];

export const PULSE_METRIC_LABELS: Record<PulseMetricKey, string> = {
  signups: "Signups",
  active_users: "Active users (daily)",
  records_logged: "Records logged",
  jobs_opened: "Jobs opened",
  invoices_raised: "Invoices raised",
  money_collected: "Money collected",
  errors: "Errors",
};

/** Metrics with no real data source yet in this codebase — see the per-key comment for why. */
export const UNTRACKED_METRICS: Partial<Record<PulseMetricKey, string>> = {
  errors: "No error/exception logging exists in this codebase yet (no APM/Sentry-style capture) — nothing to count.",
};

export const DEFAULT_PINNED_METRICS: PulseMetricKey[] = [
  "signups",
  "active_users",
  "records_logged",
  "jobs_opened",
  "money_collected",
];

/** Reporting currency for "money collected" (AGENTS.md section 07 "Reporting currency"). */
export const REPORTING_CURRENCY = "KES";
export const REPORTING_CURRENCY_NOTE =
  "Fixed at KES — no multi-currency FX source is configured, so amounts are summed exactly as entered, without conversion. Accounts outside the KE region are not currency-converted; this is a stated simplification, not a silent one.";

async function countInRange(key: PulseMetricKey, range: DateRange): Promise<number | null> {
  const { start, end } = range;
  switch (key) {
    case "signups":
      return prisma.account.count({ where: { createdAt: { gte: start, lt: end } } });
    case "active_users":
      // Proxy metric — see AGENTS.md Definitions: mobile has no open-app/session
      // analytics, so "API request activity tied to an account" (the most
      // recent authenticated /api/v1/* call, see src/lib/api/auth.ts) stands
      // in for "opened the app". Expect this to read near-zero until real
      // mobile traffic accumulates beyond the single seeded dev account.
      return prisma.account.count({ where: { lastApiRequestAt: { gte: start, lt: end } } });
    case "records_logged": {
      const where = { createdAt: { gte: start, lt: end } };
      const fuelDeletable = { ...where, deletedAt: null };
      const [fuel, service, repair, expense, odometer] = await Promise.all([
        prisma.fuelRecord.count({ where: fuelDeletable }),
        prisma.serviceRecord.count({ where: fuelDeletable }),
        prisma.repairRecord.count({ where: fuelDeletable }),
        prisma.expenseRecord.count({ where: fuelDeletable }),
        prisma.odometerReading.count({ where }), // no deletedAt column on this table
      ]);
      return fuel + service + repair + expense + odometer;
    }
    case "jobs_opened":
      return prisma.job.count({ where: { createdAt: { gte: start, lt: end } } });
    case "invoices_raised":
      return prisma.invoice.count({ where: { createdAt: { gte: start, lt: end }, deletedAt: null } });
    case "money_collected": {
      const agg = await prisma.payment.aggregate({
        where: { paidAt: { gte: start, lt: end }, deletedAt: null },
        _sum: { amount: true },
      });
      return agg._sum.amount?.toNumber() ?? 0;
    }
    case "errors":
      return null; // untracked — see UNTRACKED_METRICS
  }
}

export type MetricDirection = "up" | "down" | "flat" | "unknown";

export type MetricSnapshot = {
  key: PulseMetricKey;
  label: string;
  today: number | null;
  yesterday: number | null;
  trailing7Avg: number | null;
  direction: MetricDirection;
  thisWeek: number | null;
  lastWeek: number | null;
  weekDeltaAbsolute: number | null;
  weekDeltaPercent: number | null; // e.g. 12.5 means +12.5%
  untrackedReason?: string;
};

function direction(today: number, avg: number): MetricDirection {
  if (avg === 0) return today === 0 ? "flat" : "up";
  const ratio = today / avg;
  if (ratio > 1.05) return "up";
  if (ratio < 0.95) return "down";
  return "flat";
}

/** Full PULSE-01/04/05 snapshot for one metric. */
export async function getMetricSnapshot(key: PulseMetricKey): Promise<MetricSnapshot> {
  if (UNTRACKED_METRICS[key]) {
    return {
      key,
      label: PULSE_METRIC_LABELS[key],
      today: null,
      yesterday: null,
      trailing7Avg: null,
      direction: "unknown",
      thisWeek: null,
      lastWeek: null,
      weekDeltaAbsolute: null,
      weekDeltaPercent: null,
      untrackedReason: UNTRACKED_METRICS[key],
    };
  }

  const todayRange = eatDay(0);
  const yesterdayRange = eatDay(1);
  const trailingRanges = Array.from({ length: 7 }, (_, i) => eatDay(i + 1)); // yesterday .. 7 days ago

  const weekdayIdx = eatWeekdayIndex(); // 0 = Monday
  const thisWeekRanges = Array.from({ length: weekdayIdx + 1 }, (_, i) => eatDay(i)); // today back to this Monday
  const lastWeekRanges = Array.from({ length: weekdayIdx + 1 }, (_, i) => eatDay(i + 7)); // same span, one week back

  const [today, yesterday, trailingCounts, thisWeekCounts, lastWeekCounts] = await Promise.all([
    countInRange(key, todayRange),
    countInRange(key, yesterdayRange),
    Promise.all(trailingRanges.map((r) => countInRange(key, r))),
    Promise.all(thisWeekRanges.map((r) => countInRange(key, r))),
    Promise.all(lastWeekRanges.map((r) => countInRange(key, r))),
  ]);

  const trailingSum = trailingCounts.reduce((s: number, v) => s + (v ?? 0), 0);
  const trailing7Avg = trailingSum / trailingRanges.length;
  const thisWeek = thisWeekCounts.reduce((s: number, v) => s + (v ?? 0), 0);
  const lastWeek = lastWeekCounts.reduce((s: number, v) => s + (v ?? 0), 0);
  const weekDeltaAbsolute = thisWeek - lastWeek;
  const weekDeltaPercent = lastWeek === 0 ? (thisWeek === 0 ? 0 : 100) : (weekDeltaAbsolute / lastWeek) * 100;

  return {
    key,
    label: PULSE_METRIC_LABELS[key],
    today,
    yesterday,
    trailing7Avg,
    direction: direction(today ?? 0, trailing7Avg),
    thisWeek,
    lastWeek,
    weekDeltaAbsolute,
    weekDeltaPercent,
  };
}

export async function getAllMetricSnapshots(): Promise<Record<PulseMetricKey, MetricSnapshot>> {
  const entries = await Promise.all(
    PULSE_METRIC_KEYS.map(async (key) => [key, await getMetricSnapshot(key)] as const),
  );
  return Object.fromEntries(entries) as Record<PulseMetricKey, MetricSnapshot>;
}

/**
 * PULSE-02's one real-data alert type: a headline metric whose today figure
 * is notably outside its trailing-7-day band (wider threshold than the
 * up/down direction marker, reserved for "worth a look" not just "moved").
 */
export type BandAlert = { key: PulseMetricKey; label: string; today: number; avg: number; deviationPercent: number };

export function findOutOfBandMetrics(snapshots: Record<PulseMetricKey, MetricSnapshot>): BandAlert[] {
  const alerts: BandAlert[] = [];
  for (const key of PULSE_METRIC_KEYS) {
    const s = snapshots[key];
    if (s.today == null || s.trailing7Avg == null) continue;
    if (s.trailing7Avg === 0 && s.today === 0) continue;
    const deviationPercent =
      s.trailing7Avg === 0 ? 100 : ((s.today - s.trailing7Avg) / s.trailing7Avg) * 100;
    if (Math.abs(deviationPercent) >= 50) {
      alerts.push({ key, label: s.label, today: s.today, avg: s.trailing7Avg, deviationPercent });
    }
  }
  return alerts;
}
