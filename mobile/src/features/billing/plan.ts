import type { PlanState } from '@/types/domain';

/** Whole days until an ISO time, never negative. */
export function daysLeft(iso: string | null): number {
  if (!iso) return 0;
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000));
}

/** Short tracked label for a plan: "PRO TRIAL · 13 DAYS", "PERSONAL", "FREE". */
export function planMeta(p: PlanState | null | undefined): string {
  if (!p) return '';
  if (p.state === 'trial') {
    const d = daysLeft(p.trialEndsAt);
    return `${p.name.toUpperCase()} TRIAL · ${d} DAY${d === 1 ? '' : 'S'}`;
  }
  if (p.state === 'grace') return `${p.name.toUpperCase()} · PAYMENT DUE`;
  return p.name.toUpperCase();
}
