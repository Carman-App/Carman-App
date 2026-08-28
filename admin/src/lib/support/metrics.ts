import "server-only";
import { prisma } from "@/lib/prisma";
import { TicketStatus, TicketCategory } from "@/generated/prisma/enums";

// SUP-08 — response/resolution time metrics, computed live from Ticket rows.
// No metrics table exists (nor should one — these are cheaply derivable),
// so every function here re-reads Ticket on each call.

const MS_PER_MINUTE = 60 * 1000;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/** Monday 00:00 of the week containing `date`. */
function startOfWeek(date: Date): Date {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay(); // 0 = Sunday
  const diffToMonday = day === 0 ? 6 : day - 1;
  d.setUTCDate(d.getUTCDate() - diffToMonday);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

export type WeeklyResponseMetric = {
  weekStart: Date;
  ticketsOpened: number;
  medianFirstResponseMinutes: number | null;
  medianResolutionMinutes: number | null;
  respondedCount: number;
  resolvedCount: number;
};

/**
 * Median first-response and resolution time, bucketed by the week a ticket
 * was *opened* in (createdAt). A ticket only contributes to the response
 * median once firstRespondedAt is set, and to the resolution median once
 * resolvedAt is set — tickets still waiting simply don't contribute yet
 * rather than being counted as zero.
 */
export async function getWeeklyResponseMetrics(weeksBack = 8): Promise<WeeklyResponseMetric[]> {
  const now = new Date();
  const earliestWeekStart = addDays(startOfWeek(now), -7 * (weeksBack - 1));

  const tickets = await prisma.ticket.findMany({
    where: { createdAt: { gte: earliestWeekStart } },
    select: { createdAt: true, firstRespondedAt: true, resolvedAt: true },
  });

  const buckets = new Map<
    number,
    { weekStart: Date; opened: number; responseMinutes: number[]; resolutionMinutes: number[] }
  >();
  for (let i = 0; i < weeksBack; i++) {
    const weekStart = addDays(earliestWeekStart, i * 7);
    buckets.set(weekStart.getTime(), { weekStart, opened: 0, responseMinutes: [], resolutionMinutes: [] });
  }

  for (const t of tickets) {
    const weekStart = startOfWeek(t.createdAt);
    const bucket = buckets.get(weekStart.getTime());
    if (!bucket) continue; // outside the requested window (shouldn't happen given the query filter)
    bucket.opened += 1;
    if (t.firstRespondedAt) {
      bucket.responseMinutes.push((t.firstRespondedAt.getTime() - t.createdAt.getTime()) / MS_PER_MINUTE);
    }
    if (t.resolvedAt) {
      bucket.resolutionMinutes.push((t.resolvedAt.getTime() - t.createdAt.getTime()) / MS_PER_MINUTE);
    }
  }

  return [...buckets.values()]
    .sort((a, b) => a.weekStart.getTime() - b.weekStart.getTime())
    .map((b) => ({
      weekStart: b.weekStart,
      ticketsOpened: b.opened,
      medianFirstResponseMinutes: median(b.responseMinutes),
      medianResolutionMinutes: median(b.resolutionMinutes),
      respondedCount: b.responseMinutes.length,
      resolvedCount: b.resolutionMinutes.length,
    }));
}

/** Tickets still OPEN or PENDING that were opened more than 24 hours ago. */
export async function getOpenPastADayCount(): Promise<number> {
  const cutoff = new Date(Date.now() - MS_PER_DAY);
  return prisma.ticket.count({
    where: {
      status: { in: [TicketStatus.OPEN, TicketStatus.PENDING] },
      createdAt: { lt: cutoff },
    },
  });
}

export type MonthlyCategoryCount = {
  monthLabel: string; // e.g. "2026-08"
  monthStart: Date;
  counts: Partial<Record<TicketCategory, number>>;
  total: number;
};

/**
 * SUP-06 "monthly count by category" — closed tickets only (category is
 * required at close time, so an open/pending ticket has no category to
 * count by yet), bucketed by the month closedAt falls in.
 */
export async function getMonthlyClosedCategoryCounts(monthsBack = 6): Promise<MonthlyCategoryCount[]> {
  const now = new Date();
  const earliestMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (monthsBack - 1), 1));

  const tickets = await prisma.ticket.findMany({
    where: {
      status: TicketStatus.CLOSED,
      closedAt: { gte: earliestMonthStart, not: null },
    },
    select: { closedAt: true, category: true },
  });

  const buckets = new Map<string, MonthlyCategoryCount>();
  for (let i = 0; i < monthsBack; i++) {
    const monthStart = new Date(Date.UTC(earliestMonthStart.getUTCFullYear(), earliestMonthStart.getUTCMonth() + i, 1));
    const label = `${monthStart.getUTCFullYear()}-${String(monthStart.getUTCMonth() + 1).padStart(2, "0")}`;
    buckets.set(label, { monthLabel: label, monthStart, counts: {}, total: 0 });
  }

  for (const t of tickets) {
    if (!t.closedAt) continue;
    const label = `${t.closedAt.getUTCFullYear()}-${String(t.closedAt.getUTCMonth() + 1).padStart(2, "0")}`;
    const bucket = buckets.get(label);
    if (!bucket) continue;
    const cat = t.category ?? "OTHER";
    bucket.counts[cat as TicketCategory] = (bucket.counts[cat as TicketCategory] ?? 0) + 1;
    bucket.total += 1;
  }

  return [...buckets.values()].sort((a, b) => a.monthStart.getTime() - b.monthStart.getTime());
}
