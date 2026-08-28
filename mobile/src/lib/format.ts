/** Formatting helpers shared across screens. Kept dependency-free (no Intl assumptions beyond what RN/Hermes ships). */

export function formatMoney(amount: number, currency = 'KES'): string {
  const rounded = Math.round(amount);
  const parts = Math.abs(rounded).toString().split('').reverse();
  const grouped: string[] = [];
  for (let i = 0; i < parts.length; i += 1) {
    if (i > 0 && i % 3 === 0) grouped.push(',');
    grouped.push(parts[i]);
  }
  const digits = grouped.reverse().join('');
  return `${rounded < 0 ? '-' : ''}${currency ? currency + ' ' : ''}${digits}`;
}

export function formatNumber(value: number): string {
  const rounded = Math.round(value);
  const parts = Math.abs(rounded).toString().split('').reverse();
  const grouped: string[] = [];
  for (let i = 0; i < parts.length; i += 1) {
    if (i > 0 && i % 3 === 0) grouped.push(',');
    grouped.push(parts[i]);
  }
  return `${rounded < 0 ? '-' : ''}${grouped.reverse().join('')}`;
}

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const MONTHS_LONG = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export function formatDateShort(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return iso;
  return `${String(d.getDate()).padStart(2, '0')} ${MONTHS[d.getMonth()]}`;
}

export function formatDateLong(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getDate()} ${MONTHS_LONG[d.getMonth()]} ${d.getFullYear()}`;
}

export function formatDateWithYear(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return iso;
  return `${String(d.getDate()).padStart(2, '0')} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** "AUGUST 2026" — used for month-grouped headers (Timeline). Accepts a full ISO date or a "YYYY-MM" key. */
export function formatMonthYear(iso: string): string {
  const [y, m] = iso.split('-');
  const monthIdx = Number(m) - 1;
  if (!y || Number.isNaN(monthIdx) || monthIdx < 0 || monthIdx > 11) return iso;
  return `${MONTHS_LONG[monthIdx].toUpperCase()} ${y}`;
}

/** Registration/plate is optional (not collected at onboarding) — shown as this placeholder until added. */
export const NO_PLATE_LABEL = 'NO PLATE YET';

/**
 * 'UNASSIGNED' is the placeholder onboarding/vehicle-add send to the real
 * API, which requires a non-empty `plate` (the mock made it optional — see
 * mobile/src/data/api/mappers.ts's module doc). Treated the same as a blank
 * plate everywhere it's displayed.
 */
const UNSET_PLATE_VALUES = new Set(['', 'UNASSIGNED']);

export function formatPlate(plate?: string): string {
  return plate && !UNSET_PLATE_VALUES.has(plate.trim().toUpperCase()) ? plate : NO_PLATE_LABEL;
}

export function daysUntil(iso: string): number {
  const target = new Date(iso + 'T00:00:00').getTime();
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.round((target - today) / (1000 * 60 * 60 * 24));
}

export function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
