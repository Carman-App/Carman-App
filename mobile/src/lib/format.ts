/** Formatting helpers shared across screens. Kept dependency-free (no Intl assumptions beyond what RN/Hermes ships). */

// Region drives currency for the whole app (spec: "Region chosen once at
// sign-up, sets currency ... for everything after" — never re-entered per
// record). `setActiveCurrency` is called once the account's region loads
// (see `@/data/hooks`'s `useSyncAccountCurrency`, wired at the app root in
// `_layout.tsx`) so every `formatMoney` call after that reflects the
// account's own currency instead of a hardcoded default. 'KES' remains the
// fallback for the brief window before the account query resolves.
let activeCurrency = 'KES';

export function setActiveCurrency(currency: string): void {
  activeCurrency = currency;
}

/** The account's currency code (e.g. "KES", "UGX") for labels/prefixes that need it outside `formatMoney` (input field prefixes, "PER KM" captions). */
export function getActiveCurrency(): string {
  return activeCurrency;
}

// Region also drives distance/volume units for the whole app, same rationale
// as `activeCurrency` above (set once at sign-up, never re-entered per
// record). `setActiveDistanceUnit`/`setActiveVolumeUnit` are called once the
// account's region loads (see `@/data/hooks`'s `useSyncAccountCurrency`,
// wired at the app root in `_layout.tsx`) so every `formatDistance`/
// `formatVolume` call after that reflects the account's own units instead of
// the hardcoded defaults. 'km'/'L' remain the fallback for the brief window
// before the account query resolves, and are also Kenya's actual units.
let activeDistanceUnit: 'km' | 'mi' = 'km';
let activeVolumeUnit: 'L' | 'gal' = 'L';

export function setActiveDistanceUnit(unit: 'km' | 'mi'): void {
  activeDistanceUnit = unit;
}

export function getActiveDistanceUnit(): 'km' | 'mi' {
  return activeDistanceUnit;
}

export function setActiveVolumeUnit(unit: 'L' | 'gal'): void {
  activeVolumeUnit = unit;
}

export function getActiveVolumeUnit(): 'L' | 'gal' {
  return activeVolumeUnit;
}

// Exported (not just used internally by `formatDistance`/`formatVolume`)
// because a couple of screens display a *rate* over distance/volume — cost
// per km (Insights, report preview) and price per litre (Fuel entry) — which
// isn't itself a plain distance/volume value `formatDistance`/`formatVolume`
// can format, but still needs the same km->mi / L->gal conversion applied
// (inverted, since a rate goes the other way: cost per mile is cost per km
// times km-per-mile, not km-per-mile itself) before display in a mi/gal region.
export const KM_TO_MI = 0.621371;
export const L_TO_GAL = 0.264172;

/**
 * Formats a km value for display, converting to miles when the active
 * account region uses them. Branches on the unit rather than always
 * multiplying so a km-region account (e.g. Kenya) gets back the exact same
 * number it would have before unit-awareness existed — no float round-trip
 * through a `* 1`. Matches the existing "42,000 KM" call-site format.
 * `opts.withUnit: false` returns just the converted number (no suffix) for
 * screens that render the unit label separately (e.g. as its own styled
 * badge next to a large numeric value).
 */
export function formatDistance(km: number, opts?: { unit?: 'km' | 'mi'; withUnit?: boolean }): string {
  const unit = opts?.unit ?? activeDistanceUnit;
  const value = unit === 'mi' ? km * KM_TO_MI : km;
  const formatted = formatNumber(value);
  return opts?.withUnit === false ? formatted : `${formatted} ${unit.toUpperCase()}`;
}

/**
 * Formats a litres value for display, converting to gallons when the active
 * account region uses them. Same no-op-for-base-unit branching and
 * `opts.withUnit` behavior as `formatDistance`. Matches the existing "42 L"
 * call-site format.
 */
export function formatVolume(litres: number, opts?: { unit?: 'L' | 'gal'; withUnit?: boolean }): string {
  const unit = opts?.unit ?? activeVolumeUnit;
  const value = unit === 'gal' ? litres * L_TO_GAL : litres;
  const formatted = formatNumber(value);
  return opts?.withUnit === false ? formatted : `${formatted} ${unit.toUpperCase()}`;
}

export function formatMoney(amount: number, currency = activeCurrency): string {
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
