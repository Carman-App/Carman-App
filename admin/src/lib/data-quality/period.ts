import "server-only";

// Shared "selectable period" control used across the Records & data quality
// surface (DATA-01/02/04/05). Kept to a small fixed set of round numbers
// rather than a free-text date range — every consumer needs a period *and*
// (for DATA-01) an equal-length prior period to compare against, which is
// simplest to reason about with fixed day-counts.
export const PERIOD_OPTIONS = [7, 30, 90, 180, 365] as const;
export type PeriodDays = (typeof PERIOD_OPTIONS)[number];
export const DEFAULT_PERIOD_DAYS: PeriodDays = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

export function parsePeriodDays(value: string | string[] | undefined): PeriodDays {
  const raw = Array.isArray(value) ? value[0] : value;
  const n = Number(raw);
  return (PERIOD_OPTIONS as readonly number[]).includes(n) ? (n as PeriodDays) : DEFAULT_PERIOD_DAYS;
}

export type PeriodRange = { start: Date; end: Date };

/** [start, end) for "the last `days` days up to now", and the equal-length period immediately before it. */
export function currentAndPriorPeriod(days: number, now: Date = new Date()): { current: PeriodRange; prior: PeriodRange } {
  const end = now;
  const start = new Date(end.getTime() - days * DAY_MS);
  const priorEnd = start;
  const priorStart = new Date(start.getTime() - days * DAY_MS);
  return { current: { start, end }, prior: { start: priorStart, end: priorEnd } };
}

export function daysAgo(days: number, now: Date = new Date()): Date {
  return new Date(now.getTime() - days * DAY_MS);
}

/** Percent change from `prior` to `current`, or null when there's no baseline (prior === 0) to compute a percentage against. */
export function percentChange(current: number, prior: number): number | null {
  if (prior === 0) return null;
  return ((current - prior) / prior) * 100;
}

export function trendDirection(current: number, prior: number): "up" | "down" | "flat" {
  if (current === prior) return "flat";
  return current > prior ? "up" : "down";
}
