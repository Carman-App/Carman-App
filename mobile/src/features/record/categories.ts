import type { RecordType } from '@/types/domain';

/**
 * The "what happened?" category list shown in `/record/add`, and the lookup
 * table `/record/expense` uses (by `categoryLabel` param) to render the right
 * title/glyph and map the pick to the closest VehicleRecord type/category.
 *
 * Fuel, Service, Document and Odometer reading route to their own dedicated
 * screens instead and aren't part of this "generalized expense" list, but are
 * kept here too so `/record/add` has a single source of truth for the list.
 *
 * PARTIAL, real, working, with a documented limitation: this is intentionally
 * NOT wired to the admin `record_categories` ConfigList. That list only has
 * 5 items (fuel/service/repair/part/insurance) as generic `{code, label,
 * sortOrder, metadata}` rows, while this array has ~19 entries carrying
 * mobile-only UI metadata — `route`, `glyph`, `subtypes` — that the config
 * schema has no equivalent for. A full swap would either 404 on dead routes
 * for the ~14 categories the admin list doesn't know about, or silently drop
 * their glyphs/subtypes; neither is an honest integration. Doing a partial
 * override (using fetched labels for just the 5 overlapping codes) was also
 * considered and rejected: it would make 5 of 19 rows re-render with
 * different text after a network round-trip for no real product benefit,
 * while adding a config dependency to a screen that currently renders
 * instantly. Revisit this once the admin config shape for record categories
 * grows routing/icon/subtype fields, or a mobile-side mapping table for the
 * ~14 orphan categories is deliberately designed — not before.
 */
export type CategoryConfig = {
  key: string;
  label: string;
  sub: string;
  glyph: string;
  /** Where tapping this row in `/record/add` should go. */
  route: '/record/fuel' | '/record/service' | '/record/odometer-roll' | '/doc/scan' | '/record/expense';
  /** Only set for rows that route to `/record/expense`. */
  type?: RecordType;
  category?: 'fuel' | 'service' | 'insurance' | 'loan' | 'other';
  subtypes?: string[];
};

export const RECORD_CATEGORIES: CategoryConfig[] = [
  { key: 'fuel', label: 'Fuel', sub: 'LITRES · PRICE · ODOMETER', glyph: 'fuel', route: '/record/fuel' },
  { key: 'service', label: 'Service', sub: 'MULTIPLE LINE ITEMS', glyph: 'service', route: '/record/service' },
  {
    key: 'repair',
    label: 'Repair',
    sub: 'PARTS · LABOUR · WARRANTY',
    glyph: 'repair',
    route: '/record/expense',
    type: 'repair',
    category: 'other',
    subtypes: ['Engine repair', 'Bodywork', 'Electrical', 'Brakes'],
  },
  {
    key: 'part',
    label: 'Parts',
    sub: 'TYRES · BATTERY · BRAKES',
    glyph: 'part',
    route: '/record/expense',
    type: 'part',
    category: 'other',
    subtypes: ['Tyres', 'Battery', 'Brakes', 'Filters'],
  },
  {
    key: 'insurance',
    label: 'Insurance',
    sub: 'PREMIUM · COVER · EXCESS',
    glyph: 'insurance',
    route: '/record/expense',
    type: 'expense',
    category: 'insurance',
    subtypes: ['Premium payment', 'Excess', 'Cover upgrade', 'Renewal'],
  },
  {
    key: 'loan',
    label: 'Loan & finance',
    sub: 'INSTALMENT · LENDER',
    glyph: 'loan',
    route: '/record/expense',
    type: 'expense',
    category: 'loan',
    subtypes: ['Instalment', 'Lender fee', 'Early settlement', 'Top-up'],
  },
  {
    key: 'licence',
    label: 'Licence & fees',
    sub: 'LICENCE · INSPECTION · TAX',
    glyph: 'licence',
    route: '/record/expense',
    type: 'expense',
    category: 'other',
    subtypes: ['Licence renewal', 'Inspection', 'Road tax', 'Registration'],
  },
  {
    key: 'parking',
    label: 'Parking & tolls',
    sub: 'PARKING · TOLL · AIRPORT',
    glyph: 'parking',
    route: '/record/expense',
    type: 'expense',
    category: 'other',
    subtypes: ['Parking', 'Toll', 'Airport parking'],
  },
  {
    key: 'carwash',
    label: 'Car wash & cleaning',
    sub: 'WASH · INTERIOR · DETAIL',
    glyph: 'carwash',
    route: '/record/expense',
    type: 'expense',
    category: 'other',
    subtypes: ['Car wash', 'Interior cleaning', 'Detailing', 'Polishing'],
  },
  {
    key: 'accessories',
    label: 'Accessories',
    sub: 'DASHCAM · RIMS · LIGHTS',
    glyph: 'accessories',
    route: '/record/expense',
    type: 'expense',
    category: 'other',
    subtypes: ['Dashcam', 'Rims', 'Lights', 'Interior trim'],
  },
  {
    key: 'security',
    label: 'Security',
    sub: 'TRACKER · ALARM',
    glyph: 'security',
    route: '/record/expense',
    type: 'expense',
    category: 'other',
    subtypes: ['Tracker install', 'Alarm', 'Immobiliser'],
  },
  {
    key: 'roadside',
    label: 'Roadside & recovery',
    sub: 'TOWING · BREAKDOWN',
    glyph: 'roadside',
    route: '/record/expense',
    type: 'expense',
    category: 'other',
    subtypes: ['Towing', 'Breakdown callout', 'Jump start'],
  },
  {
    key: 'fines',
    label: 'Fines & penalties',
    sub: 'PARKING · TRAFFIC',
    glyph: 'fines',
    route: '/record/expense',
    type: 'expense',
    category: 'other',
    subtypes: ['Parking fine', 'Traffic offence', 'Speed camera'],
  },
  {
    key: 'subscriptions',
    label: 'Subscriptions',
    sub: 'TRACKER · CONNECTED CAR',
    glyph: 'subscriptions',
    route: '/record/expense',
    type: 'expense',
    category: 'other',
    subtypes: ['Tracker plan', 'Connected car app', 'Data plan'],
  },
  {
    key: 'modifications',
    label: 'Modifications',
    sub: 'PERFORMANCE · PAINT · CUSTOM',
    glyph: 'modifications',
    route: '/record/expense',
    type: 'expense',
    category: 'other',
    subtypes: ['Performance', 'Paint', 'Custom work'],
  },
  { key: 'document', label: 'Document', sub: 'SCAN OR UPLOAD', glyph: 'document', route: '/doc/scan' },
  { key: 'odometer', label: 'Odometer reading', sub: 'ROLL IT FORWARD', glyph: 'odometer', route: '/record/odometer-roll' },
  {
    key: 'other',
    label: 'Something else',
    sub: 'ANY OTHER COST',
    glyph: 'other',
    route: '/record/expense',
    type: 'expense',
    category: 'other',
    subtypes: ['Other cost'],
  },
];

export function findCategoryByLabel(label: string | undefined): CategoryConfig {
  const fallback = RECORD_CATEGORIES[RECORD_CATEGORIES.length - 1];
  if (!label) return fallback;
  return RECORD_CATEGORIES.find((c) => c.label.toLowerCase() === label.toLowerCase()) ?? fallback;
}
