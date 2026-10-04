/**
 * The record forms, field for field from the design source's REC array
 * (Carma_App.html): the amount first, then each field with its kind, label,
 * placeholder and icon, and the reminder toggle where the design has one.
 * The form groups fields the way the design does: Cost, Details, Where,
 * Odometer, When.
 *
 * App keys differ from the design's for five categories (the server and the
 * category list already use them): part = parts, carwash = wash,
 * subscriptions = subs, modifications = mods, other = else. Document and
 * Odometer reading have their own screens (/doc/scan, /record/odometer-roll).
 */
import type { NewReminder } from '@/data/repo';

export type FieldKind = 'num' | 'text' | 'area' | 'chips' | 'place' | 'date';
export type FormGroup = 'Cost' | 'Details' | 'Where' | 'Odometer' | 'When';

export type FormField = {
  k: string;
  label: string;
  kind: FieldKind;
  ph?: string;
  suffix?: string;
  opts?: string[];
};

export type ReminderContext = {
  values: Record<string, string>;
  /** The record's date (YYYY-MM-DD). */
  date: string;
  odometer?: number;
  nextServiceDueKm?: number;
  vehicleName: string;
};

export type FormReminder = {
  label: string;
  /** The hint under the label; may depend on what has been typed. */
  hint: (ctx: ReminderContext) => string;
  /** The field the reminder counts from, which must be filled for it to be set. */
  needs?: string;
  build: (ctx: ReminderContext) => NewReminder | null;
};

export type FormSpec = {
  /** Design key (REC k), for reference. */
  designKey: string;
  /** Tracked helper above the title ("LITRES · PRICE · ODOMETER"). */
  helper: string;
  /** Category icon (IconGlyph key). */
  glyph: string;
  /** Amount field label ("Total cost", "Premium"...). */
  amount: string;
  fields: FormField[];
  remind?: FormReminder;
};

/** Field icons (design FIELD_IC), as IconGlyph keys. */
export const FIELD_GLYPH: Record<string, string> = {
  litres: 'f-fuel', ppl: 'f-coins', odo: 'f-speed', fill: 'f-fuel', station: 'f-store', date: 'f-calendar', note: 'f-text',
  shop: 'f-garage', work: 'f-wrench', parts: 'f-package', labour: 'f-wrench', complaint: 'f-alert', findings: 'f-note1',
  item: 'f-package', brand: 'f-tag', qty: 'f-hashtag', fitted: 'f-badge', supplier: 'f-store', insurer: 'f-building',
  policy: 'f-hashtag', cover: 'f-shield', excess: 'f-cash', start: 'f-calendar1', end: 'f-calendar', lender: 'f-bank',
  num: 'f-hashtag', principal: 'f-cash', interest: 'f-percent', due: 'f-calendar', type: 'f-tag', ref: 'f-hashtag',
  issued: 'f-calendar1', place: 'f-location', dur: 'f-time', installer: 'f-wrench', provider: 'f-building', recur: 'f-repeat',
  reason: 'f-alert', issuer: 'f-building', offence: 'f-alert', paid: 'f-badge', plan: 'f-note', cycle: 'f-repeat',
  next: 'f-calendar', project: 'f-paint', title: 'f-note1', when: 'f-clock', what: 'f-note1', cat: 'f-tag',
};

/** Option icons (design OPT_IC). */
export const OPTION_GLYPH: Record<string, string> = {
  Full: 'f-fuel', Partial: 'f-percent', 'Fitted now': 'f-badge', 'Bought only': 'f-bag', Comprehensive: 'f-shield',
  'Third party': 'f-license', Licence: 'f-license', Inspection: 'f-badge', 'Road tax': 'f-cash', Parking: 'f-parking',
  Toll: 'f-location', Airport: 'f-location1', Wash: 'f-sparkles', Interior: 'f-car-signal', 'Full detail': 'f-sparkles',
  Tracker: 'f-location', Alarm: 'f-alert', Immobiliser: 'f-lock', Tow: 'f-tow', Breakdown: 'f-alert', 'Jump start': 'f-repeat',
  Paid: 'f-badge', Unpaid: 'f-alert', Monthly: 'f-calendar', Annual: 'f-calendar1', 'E36 build': 'f-paint', None: 'f-close',
  Insurance: 'f-shield', Logbook: 'f-file', Invoice: 'f-invoice', Other: 'f-more', Storage: 'f-package', Import: 'f-tow',
  Logistics: 'f-package', Tools: 'f-wrench',
};

export function fieldGlyph(f: FormField): string {
  return FIELD_GLYPH[f.k] ?? (f.kind === 'date' ? 'f-calendar' : f.kind === 'num' ? 'f-hashtag' : f.kind === 'area' ? 'f-text' : 'f-tag');
}

/** Design groupOf: money fields are Cost, places Where, dates When, odo Odometer, the rest Details. */
const MONEY = new Set(['ppl', 'parts', 'labour', 'excess', 'principal', 'interest', 'recur', 'qty']);
export function groupOf(f: FormField): FormGroup {
  if (f.kind === 'place') return 'Where';
  if (f.kind === 'date') return 'When';
  if (MONEY.has(f.k)) return 'Cost';
  if (f.k === 'odo') return 'Odometer';
  return 'Details';
}

/** Which nearby places the place sheet shows for a field. */
export function placeKindOf(k: string, spec: FormSpec): string | undefined {
  if (k === 'station') return 'station';
  if (k === 'shop' || k === 'installer') return 'workshop';
  if (k === 'supplier') return 'supplier';
  if (spec.designKey === 'wash') return 'wash';
  if (spec.designKey === 'parking') return 'parking';
  return undefined;
}

/** Dates that can only be in the past (when something happened). Expiry, due and next-charge dates can be later. */
export const PAST_DATES = new Set(['date', 'issued', 'when']);

// ---------- date helpers for reminders ----------

function parse(iso: string) {
  return new Date(iso + 'T00:00:00');
}
function out(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function addMonths(iso: string, n: number) {
  const d = parse(iso);
  d.setMonth(d.getMonth() + n);
  return out(d);
}
export function addDays(iso: string, n: number) {
  const d = parse(iso);
  d.setDate(d.getDate() + n);
  return out(d);
}
const fmtKm = (n: number) => n.toLocaleString('en-US');

/** Next service distance: the vehicle's own interval if set, else the next 10,000 km mark at least 5,000 km on. */
function nextServiceKm(ctx: ReminderContext) {
  const odo = ctx.odometer;
  if (ctx.nextServiceDueKm && (!odo || ctx.nextServiceDueKm > odo)) return ctx.nextServiceDueKm;
  if (!odo) return undefined;
  return Math.ceil((odo + 5000) / 10000) * 10000;
}

const before = (field: string, days: number, kind: NewReminder['kind'], what: (ctx: ReminderContext) => string, repeatMonths?: (ctx: ReminderContext) => number | undefined) =>
  (ctx: ReminderContext): NewReminder | null => {
    const due = ctx.values[field];
    if (!due) return null;
    return { kind, description: what(ctx), dueDate: due, remindAt: addDays(due, -days), repeatMonths: repeatMonths?.(ctx) };
  };

const v = (ctx: ReminderContext, k: string, fallback: string) => ctx.values[k]?.trim() || fallback;

export const FORM_SPECS: Record<string, FormSpec> = {
  fuel: {
    designKey: 'fuel',
    helper: 'LITRES · PRICE · ODOMETER',
    glyph: 'fuel',
    amount: 'Total cost',
    fields: [
      { k: 'litres', label: 'Litres', kind: 'num', ph: '42.5' },
      { k: 'ppl', label: 'Price per litre', kind: 'num', ph: '189.00' },
      { k: 'odo', label: 'Odometer', kind: 'num', ph: '84,520', suffix: 'km' },
      { k: 'fill', label: 'Tank', kind: 'chips', opts: ['Full', 'Partial'] },
      { k: 'station', label: 'Station', kind: 'place', ph: 'Shell Westlands' },
      { k: 'date', label: 'Date', kind: 'date', ph: 'Today' },
      { k: 'note', label: 'Note', kind: 'area', ph: 'Optional' },
    ],
  },
  service: {
    designKey: 'service',
    helper: 'MULTIPLE LINE ITEMS',
    glyph: 'service',
    amount: 'Total cost',
    fields: [
      { k: 'shop', label: 'Workshop', kind: 'place', ph: "Joe's Auto" },
      { k: 'work', label: 'Work performed', kind: 'area', ph: 'Oil, filters, brake fluid' },
      { k: 'parts', label: 'Parts', kind: 'num', ph: '9,500' },
      { k: 'labour', label: 'Labour', kind: 'num', ph: '6,000' },
      { k: 'odo', label: 'Odometer', kind: 'num', ph: '84,520', suffix: 'km' },
      { k: 'date', label: 'Date', kind: 'date', ph: 'Today' },
    ],
    remind: {
      label: 'Remind me at the next service',
      hint: (ctx) => {
        const km = nextServiceKm(ctx);
        return km ? `${fmtKm(km)} km or 12 months, whichever comes first` : '12 months from this service, or add the odometer to set a distance too';
      },
      build: (ctx) => {
        const due = addMonths(ctx.date, 12);
        return { kind: 'SERVICE_DUE', description: `${ctx.vehicleName} service due`, dueDate: due, dueKm: nextServiceKm(ctx), remindAt: addDays(due, -14) };
      },
    },
  },
  repair: {
    designKey: 'repair',
    helper: 'PARTS · LABOUR · WARRANTY',
    glyph: 'repair',
    amount: 'Total cost',
    fields: [
      { k: 'shop', label: 'Workshop', kind: 'place', ph: "Joe's Auto" },
      { k: 'complaint', label: 'Complaint', kind: 'text', ph: 'Grinding when braking' },
      { k: 'findings', label: 'Findings and work done', kind: 'area', ph: 'Front pads and discs replaced' },
      { k: 'parts', label: 'Parts', kind: 'num', ph: '18,400' },
      { k: 'labour', label: 'Labour', kind: 'num', ph: '6,100' },
      { k: 'odo', label: 'Odometer', kind: 'num', ph: '84,520', suffix: 'km' },
      { k: 'date', label: 'Date', kind: 'date', ph: 'Today' },
    ],
    remind: {
      label: 'Remind me before the warranty ends',
      hint: () => '6 months on parts and labour',
      build: (ctx) => {
        const due = addMonths(ctx.date, 6);
        return { kind: 'WARRANTY_END', description: `Repair warranty ends: ${v(ctx, 'findings', v(ctx, 'complaint', 'repair'))}`, dueDate: due, remindAt: addDays(due, -14) };
      },
    },
  },
  part: {
    designKey: 'parts',
    helper: 'TYRES · BATTERY · BRAKES',
    glyph: 'part',
    amount: 'Total cost',
    fields: [
      { k: 'item', label: 'Part', kind: 'text', ph: 'Tyres, 265/65 R17' },
      { k: 'brand', label: 'Brand', kind: 'text', ph: 'Yokohama' },
      { k: 'qty', label: 'Quantity', kind: 'num', ph: '4' },
      { k: 'fitted', label: 'Fitted', kind: 'chips', opts: ['Fitted now', 'Bought only'] },
      { k: 'supplier', label: 'Supplier', kind: 'place', ph: 'Kingsway Tyres' },
      { k: 'odo', label: 'Odometer', kind: 'num', ph: '84,520', suffix: 'km' },
      { k: 'date', label: 'Date', kind: 'date', ph: 'Today' },
    ],
    remind: {
      label: 'Remind me to check wear',
      hint: (ctx) => (ctx.odometer ? `Every 10,000 km · next at ${fmtKm(ctx.odometer + 10000)} km` : 'Every 10,000 km'),
      needs: 'odo',
      build: (ctx) => (ctx.odometer ? { kind: 'SERVICE_DUE', description: `Check wear: ${v(ctx, 'item', 'parts')}`, dueKm: ctx.odometer + 10000 } : null),
    },
  },
  insurance: {
    designKey: 'insurance',
    helper: 'PREMIUM · COVER · EXCESS',
    glyph: 'insurance',
    amount: 'Premium',
    fields: [
      { k: 'insurer', label: 'Insurer', kind: 'text', ph: 'Britam' },
      { k: 'policy', label: 'Policy number', kind: 'text', ph: 'BR/MOT/0099421' },
      { k: 'cover', label: 'Cover', kind: 'chips', opts: ['Comprehensive', 'Third party'] },
      { k: 'excess', label: 'Excess', kind: 'num', ph: '25,000' },
      { k: 'start', label: 'Starts', kind: 'date', ph: 'Today' },
      { k: 'end', label: 'Expires', kind: 'date', ph: '30 Jul 2027' },
    ],
    remind: {
      label: 'Remind me before it expires',
      hint: () => '14 days before the expiry date',
      needs: 'end',
      build: before('end', 14, 'DOCUMENT_EXPIRY', (ctx) => `${v(ctx, 'insurer', 'Insurance')} cover expires`),
    },
  },
  loan: {
    designKey: 'loan',
    helper: 'INSTALMENT · LENDER',
    glyph: 'loan',
    amount: 'Instalment',
    fields: [
      { k: 'lender', label: 'Lender', kind: 'text', ph: 'Stanbic' },
      { k: 'num', label: 'Instalment number', kind: 'num', ph: '14 of 48' },
      { k: 'principal', label: 'Principal', kind: 'num', ph: '31,200' },
      { k: 'interest', label: 'Interest', kind: 'num', ph: '9,800' },
      { k: 'due', label: 'Due date', kind: 'date', ph: '05 Oct 2026' },
    ],
    remind: {
      label: 'Remind me before each instalment',
      hint: () => '3 days before the due date, monthly',
      needs: 'due',
      build: before('due', 3, 'PAYMENT_DUE', (ctx) => `${v(ctx, 'lender', 'Loan')} instalment due`, () => 1),
    },
  },
  licence: {
    designKey: 'licence',
    helper: 'LICENCE · INSPECTION · TAX',
    glyph: 'licence',
    amount: 'Amount paid',
    fields: [
      { k: 'type', label: 'Fee', kind: 'chips', opts: ['Licence', 'Inspection', 'Road tax'] },
      { k: 'ref', label: 'Reference', kind: 'text', ph: 'NTSA/2026/44119' },
      { k: 'issued', label: 'Issued', kind: 'date', ph: 'Today' },
      { k: 'end', label: 'Expires', kind: 'date', ph: '04 Nov 2027' },
    ],
    remind: {
      label: 'Remind me before it expires',
      hint: () => '30 days before the expiry date',
      needs: 'end',
      build: before('end', 30, 'DOCUMENT_EXPIRY', (ctx) => `${v(ctx, 'type', 'Licence')} expires`),
    },
  },
  parking: {
    designKey: 'parking',
    helper: 'PARKING · TOLL · AIRPORT',
    glyph: 'parking',
    amount: 'Amount paid',
    fields: [
      { k: 'type', label: 'Kind', kind: 'chips', opts: ['Parking', 'Toll', 'Airport'] },
      { k: 'place', label: 'Location', kind: 'place', ph: 'Two Rivers' },
      { k: 'dur', label: 'Duration', kind: 'text', ph: '3 hours' },
      { k: 'date', label: 'Date', kind: 'date', ph: 'Today' },
    ],
  },
  carwash: {
    designKey: 'wash',
    helper: 'WASH · INTERIOR · DETAIL',
    glyph: 'carwash',
    amount: 'Amount paid',
    fields: [
      { k: 'type', label: 'Service', kind: 'chips', opts: ['Wash', 'Interior', 'Full detail'] },
      { k: 'place', label: 'Where', kind: 'place', ph: 'Ngong Road bay' },
      { k: 'odo', label: 'Odometer', kind: 'num', ph: '84,520', suffix: 'km' },
      { k: 'date', label: 'Date', kind: 'date', ph: 'Today' },
    ],
  },
  accessories: {
    designKey: 'accessories',
    helper: 'DASHCAM · RIMS · LIGHTS',
    glyph: 'accessories',
    amount: 'Total cost',
    fields: [
      { k: 'item', label: 'Item', kind: 'text', ph: 'Dashcam, front and rear' },
      { k: 'brand', label: 'Brand', kind: 'text', ph: 'Viofo' },
      { k: 'fitted', label: 'Fitted', kind: 'chips', opts: ['Fitted now', 'Bought only'] },
      { k: 'supplier', label: 'Supplier', kind: 'place', ph: 'Autoworld' },
      { k: 'date', label: 'Date', kind: 'date', ph: 'Today' },
    ],
  },
  security: {
    designKey: 'security',
    helper: 'TRACKER · ALARM',
    glyph: 'security',
    amount: 'Total cost',
    fields: [
      { k: 'item', label: 'Hardware', kind: 'chips', opts: ['Tracker', 'Alarm', 'Immobiliser'] },
      { k: 'provider', label: 'Provider', kind: 'text', ph: 'Track & Trace' },
      { k: 'recur', label: 'Monthly fee', kind: 'num', ph: '1,500' },
      { k: 'date', label: 'Installed', kind: 'date', ph: 'Today' },
    ],
    remind: {
      label: 'Remind me of the recurring charge',
      hint: () => 'Monthly, on the installation date',
      build: (ctx) => {
        const due = addMonths(ctx.date, 1);
        return { kind: 'PAYMENT_DUE', description: `${v(ctx, 'provider', v(ctx, 'item', 'Tracker'))} monthly fee`, dueDate: due, remindAt: due, repeatMonths: 1 };
      },
    },
  },
  roadside: {
    designKey: 'roadside',
    helper: 'TOWING · BREAKDOWN',
    glyph: 'roadside',
    amount: 'Amount paid',
    fields: [
      { k: 'reason', label: 'Reason', kind: 'chips', opts: ['Tow', 'Breakdown', 'Jump start'] },
      { k: 'provider', label: 'Provider', kind: 'text', ph: 'AA Kenya' },
      { k: 'place', label: 'Where', kind: 'place', ph: 'Mai Mahiu, A104' },
      { k: 'odo', label: 'Odometer', kind: 'num', ph: '84,520', suffix: 'km' },
      { k: 'date', label: 'Date', kind: 'date', ph: 'Today' },
    ],
  },
  fines: {
    designKey: 'fines',
    helper: 'PARKING · TRAFFIC',
    glyph: 'fines',
    amount: 'Amount',
    fields: [
      { k: 'issuer', label: 'Issued by', kind: 'text', ph: 'NTSA' },
      { k: 'offence', label: 'Offence', kind: 'text', ph: 'Speeding, 92 in an 80 zone' },
      { k: 'ref', label: 'Reference', kind: 'text', ph: 'TR/2026/88213' },
      { k: 'issued', label: 'Issued', kind: 'date', ph: 'Today' },
      { k: 'due', label: 'Pay by', kind: 'date', ph: '20 Sep 2026' },
      { k: 'paid', label: 'Status', kind: 'chips', opts: ['Paid', 'Unpaid'] },
    ],
    remind: {
      label: 'Remind me before the deadline',
      hint: () => '3 days before the pay-by date',
      needs: 'due',
      build: before('due', 3, 'PAYMENT_DUE', (ctx) => `Pay the fine: ${v(ctx, 'offence', v(ctx, 'ref', 'fine'))}`),
    },
  },
  subscriptions: {
    designKey: 'subs',
    helper: 'TRACKER · CONNECTED CAR',
    glyph: 'subscriptions',
    amount: 'Charge',
    fields: [
      { k: 'plan', label: 'Plan', kind: 'text', ph: 'Tracker monitoring' },
      { k: 'provider', label: 'Provider', kind: 'text', ph: 'Track & Trace' },
      { k: 'cycle', label: 'Billing', kind: 'chips', opts: ['Monthly', 'Annual'] },
      { k: 'next', label: 'Next charge', kind: 'date', ph: '08 Oct 2026' },
    ],
    remind: {
      label: 'Remind me before each charge',
      hint: () => '2 days before the next charge',
      needs: 'next',
      build: before('next', 2, 'PAYMENT_DUE', (ctx) => `${v(ctx, 'plan', v(ctx, 'provider', 'Subscription'))} charge`, (ctx) => (ctx.values.cycle === 'Annual' ? 12 : 1)),
    },
  },
  modifications: {
    designKey: 'mods',
    helper: 'PERFORMANCE · PAINT · CUSTOM',
    glyph: 'modifications',
    amount: 'Total cost',
    fields: [
      { k: 'item', label: 'Modification', kind: 'text', ph: 'Coilovers and strut brace' },
      { k: 'installer', label: 'Installed by', kind: 'place', ph: "Joe's Auto" },
      { k: 'project', label: 'Project', kind: 'chips', opts: ['E36 build', 'None'] },
      { k: 'odo', label: 'Odometer', kind: 'num', ph: '84,520', suffix: 'km' },
      { k: 'date', label: 'Date', kind: 'date', ph: 'Today' },
    ],
  },
  other: {
    designKey: 'else',
    helper: 'ANY OTHER COST',
    glyph: 'other',
    amount: 'Amount',
    fields: [
      { k: 'what', label: 'What was it for', kind: 'text', ph: 'Storage while abroad' },
      { k: 'cat', label: 'Closest category', kind: 'chips', opts: ['Storage', 'Import', 'Logistics', 'Tools', 'Other'] },
      { k: 'odo', label: 'Odometer', kind: 'num', ph: '84,520', suffix: 'km' },
      { k: 'date', label: 'Date', kind: 'date', ph: 'Today' },
    ],
  },
};

/** The field that becomes the record's title, and the one whose date is the record's date. */
export const TITLE_FIELD: Record<string, string> = {
  service: 'work',
  repair: 'findings',
  part: 'item',
  accessories: 'item',
  modifications: 'item',
  subscriptions: 'plan',
  fines: 'offence',
  other: 'what',
};
export const RECORD_DATE_FIELDS = ['date', 'issued', 'start'];

export function formSpecFor(key: string | undefined): FormSpec {
  return FORM_SPECS[key ?? 'other'] ?? FORM_SPECS.other;
}
