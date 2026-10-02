/**
 * The fields each record category asks for, in the design's order:
 * amount first, then the fields that belong to that kind of cost, then
 * where / when / odometer. `maps` says which draft field a value feeds;
 * everything mapped to 'detail' is kept as a labelled line in the record.
 */
export type FieldKind = 'money' | 'number' | 'text' | 'choice';
export type FieldMap = 'amount' | 'litres' | 'title' | 'place' | 'detail';
export type FormSection = 'Cost' | 'Details' | 'Where' | 'When';

export type FormField = {
  id: string;
  label: string;
  kind: FieldKind;
  section: FormSection;
  maps: FieldMap;
  placeholder?: string;
  options?: string[];
};

export type FormSpec = {
  /** Tracked eyebrow above the title ("LITRES · PRICE · ODOMETER"). */
  eyebrow: string;
  fields: FormField[];
  /** Ask for an odometer reading (distance-related costs). */
  odometer?: boolean;
};

const total = (label = 'Total cost'): FormField => ({ id: 'amount', label, kind: 'money', section: 'Cost', maps: 'amount' });
const where = (label: string, placeholder: string): FormField => ({ id: 'place', label, kind: 'text', section: 'Where', maps: 'place', placeholder });
const detail = (id: string, label: string, placeholder?: string, section: FormSection = 'Details', kind: FieldKind = 'text'): FormField => ({
  id,
  label,
  kind,
  section,
  maps: 'detail',
  placeholder,
});
const choice = (id: string, label: string, options: string[], section: FormSection = 'Details'): FormField => ({
  id,
  label,
  kind: 'choice',
  section,
  maps: 'detail',
  options,
});
const title = (label: string, placeholder: string): FormField => ({ id: 'title', label, kind: 'text', section: 'Details', maps: 'title', placeholder });

export const FORM_SPECS: Record<string, FormSpec> = {
  fuel: {
    eyebrow: 'LITRES · PRICE · ODOMETER',
    odometer: true,
    fields: [
      total(),
      detail('price', 'Price per litre', '189.00', 'Cost', 'number'),
      { id: 'litres', label: 'Litres', kind: 'number', section: 'Details', maps: 'litres', placeholder: '42.5' },
      choice('tank', 'Tank', ['Full', 'Partial']),
      detail('note', 'Note', 'Optional'),
      where('Station', 'Shell Westlands'),
    ],
  },
  service: {
    eyebrow: 'MULTIPLE LINE ITEMS',
    odometer: true,
    fields: [
      total(),
      detail('parts', 'Parts', '9,500', 'Cost', 'number'),
      detail('labour', 'Labour', '6,000', 'Cost', 'number'),
      title('Work performed', 'Oil, filters, brake fluid'),
      where('Workshop', "Joe's Auto"),
    ],
  },
  repair: {
    eyebrow: 'PARTS · LABOUR · WARRANTY',
    odometer: true,
    fields: [
      total(),
      detail('parts', 'Parts', '18,400', 'Cost', 'number'),
      detail('labour', 'Labour', '6,100', 'Cost', 'number'),
      detail('complaint', 'Complaint', 'Grinding when braking'),
      title('Findings and work done', 'Front pads and discs replaced'),
      detail('warranty', 'Warranty', '6 months'),
      where('Workshop', "Joe's Auto"),
    ],
  },
  part: {
    eyebrow: 'TYRES · BATTERY · BRAKES',
    fields: [
      total(),
      detail('qty', 'Quantity', '4', 'Cost', 'number'),
      title('Part', 'Tyres, 265/65 R17'),
      detail('brand', 'Brand', 'Yokohama'),
      choice('fitted', 'Fitted', ['Fitted', 'In storage', 'On order']),
      where('Supplier', 'Ngong Road Tyres'),
    ],
  },
  insurance: {
    eyebrow: 'PREMIUM · COVER · EXCESS',
    fields: [
      total('Premium'),
      detail('excess', 'Excess', '25,000', 'Cost', 'number'),
      detail('insurer', 'Insurer', 'Britam'),
      detail('policy', 'Policy number', 'BR/MOT/0099421'),
      choice('cover', 'Cover', ['Comprehensive', 'Third party', 'Third party, fire and theft']),
      detail('starts', 'Starts', 'Today', 'When'),
      detail('expires', 'Expires', 'In a year', 'When'),
    ],
  },
  loan: {
    eyebrow: 'INSTALMENT · LENDER',
    fields: [
      total('Instalment'),
      detail('principal', 'Principal', '31,200', 'Cost', 'number'),
      detail('interest', 'Interest', '9,800', 'Cost', 'number'),
      detail('lender', 'Lender', 'Stanbic'),
      detail('instalment', 'Instalment number', '14 of 48'),
    ],
  },
  licence: {
    eyebrow: 'LICENCE · INSPECTION · TAX',
    fields: [
      total('Amount paid'),
      choice('fee', 'Fee', ['Licence renewal', 'Inspection', 'Road tax', 'Registration']),
      detail('ref', 'Reference', 'NTSA/2026/44119'),
      detail('issued', 'Issued', 'Today', 'When'),
      detail('expires', 'Expires', 'Optional', 'When'),
    ],
  },
  parking: {
    eyebrow: 'PARKING · TOLL · AIRPORT',
    fields: [
      total('Amount paid'),
      choice('kind', 'Kind', ['Parking', 'Toll', 'Airport parking']),
      detail('duration', 'Duration', '3 hours'),
      where('Location', 'Two Rivers'),
    ],
  },
  carwash: {
    eyebrow: 'WASH · INTERIOR · DETAIL',
    odometer: true,
    fields: [
      total('Amount paid'),
      choice('service', 'Service', ['Car wash', 'Interior cleaning', 'Detailing', 'Polishing']),
      where('Where', 'Ngong Road bay'),
    ],
  },
  accessories: {
    eyebrow: 'DASHCAM · RIMS · LIGHTS',
    fields: [
      total(),
      title('Item', 'Dashcam, front and rear'),
      detail('brand', 'Brand', 'Viofo'),
      choice('fitted', 'Fitted', ['Fitted', 'Not yet']),
      where('Supplier', 'Shop or website'),
    ],
  },
  security: {
    eyebrow: 'TRACKER · ALARM',
    fields: [total('Amount paid'), choice('item', 'What', ['Tracker install', 'Alarm', 'Immobiliser']), detail('provider', 'Provider', 'Tracker company'), where('Where', 'Fitted at')],
  },
  roadside: {
    eyebrow: 'TOWING · BREAKDOWN',
    odometer: true,
    fields: [total('Amount paid'), choice('service', 'Service', ['Towing', 'Breakdown callout', 'Jump start']), detail('provider', 'Provider', 'AA Kenya'), where('Location', 'Where it happened')],
  },
  fines: {
    eyebrow: 'PARKING · TRAFFIC',
    fields: [total('Amount paid'), choice('offence', 'Offence', ['Parking fine', 'Traffic offence', 'Speed camera']), detail('ref', 'Reference', 'Ticket number'), where('Location', 'Where it was issued')],
  },
  subscriptions: {
    eyebrow: 'TRACKER · CONNECTED CAR',
    fields: [total('Amount paid'), choice('service', 'Service', ['Tracker plan', 'Connected car app', 'Data plan']), detail('provider', 'Provider', 'Provider'), choice('period', 'Period', ['Monthly', 'Yearly'])],
  },
  modifications: {
    eyebrow: 'PERFORMANCE · PAINT · CUSTOM',
    odometer: true,
    fields: [total(), detail('parts', 'Parts', 'Optional', 'Cost', 'number'), detail('labour', 'Labour', 'Optional', 'Cost', 'number'), title('Work', 'Lift kit, 2 inch'), where('Workshop', 'Who did the work')],
  },
  other: {
    eyebrow: 'ANY OTHER COST',
    fields: [total('Amount paid'), title('Description', 'What it was for'), where('Where', 'Optional')],
  },
};

export function formSpecFor(key: string | undefined): FormSpec {
  return FORM_SPECS[key ?? 'other'] ?? FORM_SPECS.other;
}
