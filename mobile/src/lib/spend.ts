/**
 * Spend arithmetic shared by Garage, Insights, Vehicle and the assistant.
 * Pure functions over `VehicleRecord[]` so every screen agrees on what
 * "this month", "fuel share" or "cost per km" means.
 */
import type { SpendSegment } from '@/components/ui/Blocks';
import { CategoryColors } from '@/theme/tokens';
import type { VehicleRecord } from '@/types/domain';

export type Period = 'month' | 'year' | 'all';

export type SpendKey = 'fuel' | 'service' | 'repair' | 'insurance' | 'loan' | 'other';

export const SPEND_LABEL: Record<SpendKey, string> = {
  fuel: 'Fuel',
  service: 'Service',
  repair: 'Repairs',
  insurance: 'Insurance',
  loan: 'Loan',
  other: 'Other',
};

const SPEND_COLOR: Record<SpendKey, string> = {
  fuel: CategoryColors.fuel.fg,
  service: CategoryColors.service.fg,
  repair: CategoryColors.repair.fg,
  insurance: CategoryColors.insurance.fg,
  loan: CategoryColors.loan.fg,
  other: CategoryColors.other.fg,
};

const ORDER: SpendKey[] = ['fuel', 'service', 'repair', 'insurance', 'loan', 'other'];

/** Which spend bucket a record counts towards. Odometer readings never count. */
export function spendKey(r: VehicleRecord): SpendKey | null {
  if (r.type === 'odometer') return null;
  if (r.type === 'fuel') return 'fuel';
  if (r.type === 'service') return 'service';
  if (r.type === 'repair' || r.type === 'part') return 'repair';
  if (r.category === 'insurance') return 'insurance';
  if (r.category === 'loan') return 'loan';
  if (r.category === 'fuel') return 'fuel';
  if (r.category === 'service') return 'service';
  return 'other';
}

function parse(iso: string) {
  return new Date(iso + 'T00:00:00');
}

export function inPeriod(iso: string, period: Period, now = new Date()): boolean {
  if (period === 'all') return true;
  const d = parse(iso);
  if (period === 'year') return d.getFullYear() === now.getFullYear();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

export function periodRecords(records: VehicleRecord[], period: Period, now = new Date()) {
  return records.filter((r) => spendKey(r) !== null && inPeriod(r.date, period, now));
}

export function sumAmount(records: VehicleRecord[]) {
  return records.reduce((s, r) => s + (spendKey(r) ? r.amount : 0), 0);
}

export function spendSegments(records: VehicleRecord[]): SpendSegment[] {
  const totals = new Map<SpendKey, number>();
  for (const r of records) {
    const k = spendKey(r);
    if (k) totals.set(k, (totals.get(k) ?? 0) + r.amount);
  }
  return ORDER.map((k) => ({ key: k, label: SPEND_LABEL[k].toUpperCase(), value: totals.get(k) ?? 0, color: SPEND_COLOR[k] }));
}

export function spendColor(k: SpendKey) {
  return SPEND_COLOR[k];
}

/** Percentage change of the current period against the same span one step earlier. */
export function periodTrend(records: VehicleRecord[], period: Period, now = new Date()): number | null {
  if (period === 'all') return null;
  const prevAnchor = period === 'year' ? new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()) : new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const current = sumAmount(periodRecords(records, period, now));
  const previous = sumAmount(periodRecords(records, period, prevAnchor));
  if (previous <= 0) return null;
  return ((current - previous) / previous) * 100;
}

export type MonthTotal = { key: string; label: string; total: number; count: number };

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

/** Month-by-month totals for the given year (Jan → current month), oldest first. */
export function monthByMonth(records: VehicleRecord[], now = new Date()): MonthTotal[] {
  const out: MonthTotal[] = [];
  for (let m = 0; m <= now.getMonth(); m += 1) {
    const key = `${now.getFullYear()}-${String(m + 1).padStart(2, '0')}`;
    const rows = records.filter((r) => spendKey(r) && r.date.startsWith(key));
    out.push({
      key,
      label: `${MONTHS[m]} ${String(now.getFullYear()).slice(2)}`,
      total: rows.reduce((s, r) => s + r.amount, 0),
      count: rows.length,
    });
  }
  return out;
}

/** Spend per distance unit over the records' odometer span, or null without enough readings. */
export function costPerKm(records: VehicleRecord[]): number | null {
  const odos = records.map((r) => r.odometerAtEntry).filter((n) => n > 0);
  if (odos.length < 2) return null;
  const span = Math.max(...odos) - Math.min(...odos);
  if (span <= 0) return null;
  return sumAmount(records) / span;
}

/** Average distance per day across the readings, used to estimate today's odometer. */
export function dailyAverageKm(records: VehicleRecord[]): number | null {
  const pts = records
    .filter((r) => r.odometerAtEntry > 0)
    .map((r) => ({ t: parse(r.date).getTime(), km: r.odometerAtEntry }))
    .sort((a, b) => a.t - b.t);
  if (pts.length < 2) return null;
  const days = (pts[pts.length - 1].t - pts[0].t) / 86_400_000;
  if (days < 1) return null;
  return (pts[pts.length - 1].km - pts[0].km) / days;
}

/** Months between the first and last record, at least one. */
export function monthsSpanned(records: VehicleRecord[]): number {
  if (records.length === 0) return 1;
  const ts = records.map((r) => parse(r.date).getTime());
  const first = new Date(Math.min(...ts));
  const last = new Date(Math.max(...ts));
  return Math.max(1, (last.getFullYear() - first.getFullYear()) * 12 + (last.getMonth() - first.getMonth()) + 1);
}
