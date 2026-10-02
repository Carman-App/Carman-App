/**
 * Carma's on-device answer engine.
 *
 * The design puts one question box on Home: "Type, or hold to speak". Until a
 * hosted model is wired in, this module answers from the garage's own data
 * (records, reminders, documents, vehicles) and turns a sentence that
 * describes something that happened into an editable draft record. Nothing
 * here writes anything: a draft only becomes a record after Review and
 * "What will change".
 */
import { costPerKm, monthByMonth, periodRecords, spendSegments, sumAmount } from '@/lib/spend';
import { daysUntil, formatDateLong, formatMoney, formatNumber } from '@/lib/format';
import type { Reminder, Vehicle, VehicleDocument, VehicleRecord } from '@/types/domain';

export type DraftKind = 'fuel' | 'service' | 'repair' | 'part' | 'expense' | 'odometer';

export type Draft = {
  kind: DraftKind;
  amount?: number;
  litres?: number;
  odometer?: number;
  place?: string;
  notes?: string;
  category?: 'fuel' | 'service' | 'insurance' | 'loan' | 'other';
  /** Where each field was read from, shown on Review ("From the plate on the invoice"). */
  sources: Partial<Record<'amount' | 'litres' | 'odometer' | 'place' | 'kind', string>>;
};

export type Answer = {
  /** First sentence is bold in the UI. */
  lead: string;
  body?: string;
  /** "Checked 38 fills and this year's average" */
  checked?: string;
  draft?: Draft;
  /** A follow-up route the answer offers ("Open the timeline"). */
  link?: { label: string; href: string };
};

export type AssistantContext = {
  currency: string;
  vehicles: Vehicle[];
  /** The vehicle the composer chip is scoped to, if any. */
  vehicle?: Vehicle;
  records: VehicleRecord[];
  reminders: Reminder[];
  documents: VehicleDocument[];
};

const NUMBER = /(\d{1,3}(?:[,\s]\d{3})+|\d+(?:\.\d+)?)/;

function num(s: string) {
  return Number(s.replace(/[,\s]/g, ''));
}

/** Pulls `<number> <unit>` style values out of a sentence. */
function grab(text: string, patterns: RegExp[]): number | undefined {
  for (const p of patterns) {
    const m = text.match(p);
    if (m) {
      const v = num(m[1]);
      if (!Number.isNaN(v)) return v;
    }
  }
  return undefined;
}

const ODO = [
  new RegExp(`(?:odo(?:meter)?|reading|read|mileage|km on the clock)\\D{0,12}${NUMBER.source}`, 'i'),
  new RegExp(`${NUMBER.source}\\s*(?:km|kms|kilometres|miles|mi)\\b`, 'i'),
];
const LITRES = [new RegExp(`${NUMBER.source}\\s*(?:l|litres|liters|ltrs?)\\b`, 'i')];
const AMOUNT = [
  new RegExp(`(?:kes|ksh|ksh\\.|shillings|usd|\\$|£|€)\\s*${NUMBER.source}`, 'i'),
  new RegExp(`${NUMBER.source}\\s*(?:bob|kes|ksh|shillings|dollars|pounds|euros)\\b`, 'i'),
  new RegExp(`(?:paid|cost|for|total|amount)\\D{0,6}${NUMBER.source}`, 'i'),
];

const KIND_WORDS: { kind: DraftKind; words: RegExp; category?: Draft['category'] }[] = [
  { kind: 'fuel', words: /\b(fill(ed)?\s?up|fuel|petrol|diesel|tank|pump)\b/i },
  { kind: 'odometer', words: /^\s*(odo(meter)?|reading)\b/i },
  { kind: 'service', words: /\b(service|oil change|serviced|filters?)\b/i },
  { kind: 'repair', words: /\b(repair|fixed|replaced|pads|discs|brakes?|clutch|bushes)\b/i },
  { kind: 'part', words: /\b(tyres?|tires?|battery|part)\b/i },
  { kind: 'expense', words: /\b(insurance|premium|cover)\b/i, category: 'insurance' },
  { kind: 'expense', words: /\b(loan|instal?ment|finance)\b/i, category: 'loan' },
  { kind: 'expense', words: /\b(parking|toll|car ?wash|wash|fine|licen[cs]e|inspection)\b/i, category: 'other' },
];

const PLACE = /\b(?:at|from|in)\s+([A-Z][\w'&.-]*(?:\s+[A-Z][\w'&.-]*){0,3})/;

/** Reads a sentence describing an event into a draft, or null if it isn't one. */
export function parseDraft(text: string): Draft | null {
  const hit = KIND_WORDS.find((k) => k.words.test(text));
  const odometer = grab(text, ODO);
  const litres = grab(text, LITRES);
  const amountRaw = grab(text, AMOUNT);
  // A bare number with no unit, when nothing else claimed it, is the amount.
  let amount = amountRaw;
  if (amount === undefined) {
    const all = Array.from(text.matchAll(new RegExp(NUMBER.source, 'g'))).map((m) => num(m[1]));
    amount = all.find((n) => n !== odometer && n !== litres);
  }
  if (!hit && odometer === undefined) return null;
  const kind: DraftKind = hit?.kind ?? 'odometer';
  const place = text.match(PLACE)?.[1];
  const sources: Draft['sources'] = { kind: 'From what you said' };
  if (amount !== undefined && kind !== 'odometer') sources.amount = 'From what you said';
  if (litres !== undefined) sources.litres = 'From what you said';
  if (odometer !== undefined) sources.odometer = 'From what you said';
  if (place) sources.place = 'From what you said';
  return {
    kind,
    amount: kind === 'odometer' ? undefined : amount,
    litres,
    odometer,
    place,
    category: hit?.category ?? (kind === 'fuel' ? 'fuel' : kind === 'service' ? 'service' : 'other'),
    notes: text.trim(),
    sources,
  };
}

const MONTH_NAME = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function scopeName(ctx: AssistantContext) {
  return ctx.vehicle ? ctx.vehicle.model : 'the garage';
}

function scoped(ctx: AssistantContext) {
  return ctx.vehicle ? ctx.records.filter((r) => r.vehicleId === ctx.vehicle!.id) : ctx.records;
}

/** Answers a question from the garage's own records. */
export function answer(question: string, ctx: AssistantContext): Answer {
  const q = question.trim();
  const lower = q.toLowerCase();
  const recs = scoped(ctx);
  const money = (n: number) => formatMoney(n, ctx.currency);

  // Something that happened → draft a record.
  // Only a sentence carrying a figure (amount, litres, reading) describes something that happened.
  const draft = /\d/.test(q) ? parseDraft(q) : null;
  if (draft && !/\?$/.test(q) && !/^(what|when|how|which|who|is|did|show)\b/i.test(q)) {
    const fills = recs.filter((r) => r.type === 'fuel' && r.litres && r.amount);
    let lead = `Here is the ${draft.kind === 'expense' ? 'expense' : draft.kind} I would record for ${scopeName(ctx)}.`;
    let body: string | undefined;
    if (draft.kind === 'fuel' && draft.amount && draft.litres) {
      const price = draft.amount / draft.litres;
      const avg = fills.length ? fills.reduce((s, r) => s + r.amount / (r.litres || 1), 0) / fills.length : null;
      lead = `A fill at ${price.toFixed(2)} a litre${avg ? `, ${Math.abs(Math.round(((price - avg) / avg) * 100))}% ${price >= avg ? 'above' : 'below'} your average` : ''}.`;
    }
    const last = recs.filter((r) => r.odometerAtEntry > 0).sort((a, b) => b.odometerAtEntry - a.odometerAtEntry)[0];
    if (draft.odometer && last) {
      const delta = draft.odometer - last.odometerAtEntry;
      body =
        delta >= 0
          ? `The reading is ${formatNumber(delta)} km on from ${formatDateLong(last.date)}. It moves your distance reminders and cost per km.`
          : `That reading is ${formatNumber(-delta)} km below the last one on ${formatDateLong(last.date)}. Check it before saving.`;
    }
    return {
      lead,
      body: body ?? 'Every field below says where it came from. Nothing is saved until you check it.',
      checked: `Checked ${fills.length || recs.length} records`,
      draft,
    };
  }

  const now = new Date();

  if (/fuel/.test(lower) && /(month|spend|spent|cost)/.test(lower)) {
    const month = periodRecords(recs, 'month', now).filter((r) => r.type === 'fuel');
    const total = sumAmount(month);
    const litres = month.reduce((s, r) => s + (r.litres ?? 0), 0);
    return {
      lead: total > 0 ? `${money(total)} on fuel in ${MONTH_NAME[now.getMonth()]}.` : `No fuel recorded in ${MONTH_NAME[now.getMonth()]} yet.`,
      body: total > 0 ? `${month.length} fill${month.length === 1 ? '' : 's'}${litres ? `, ${formatNumber(litres)} litres` : ''} for ${scopeName(ctx)}.` : 'Log a fill-up with the + and it will show here.',
      checked: `Checked ${recs.filter((r) => r.type === 'fuel').length} fills`,
      link: { label: 'Where the money went', href: '/insights' },
    };
  }

  if (/insurance/.test(lower)) {
    const docs = ctx.documents
      .filter((d) => d.type === 'insurance' && d.expiryDate)
      .sort((a, b) => (a.expiryDate! < b.expiryDate! ? -1 : 1));
    const next = docs.find((d) => daysUntil(d.expiryDate!) >= 0) ?? docs[docs.length - 1];
    if (!next) {
      return { lead: 'There is no insurance document on file yet.', body: 'Scan the policy and Carma will remind you before it expires.', link: { label: 'Documents', href: '/documents' } };
    }
    const days = daysUntil(next.expiryDate!);
    return {
      lead: days >= 0 ? `${next.title} expires in ${days} day${days === 1 ? '' : 's'}.` : `${next.title} expired ${-days} days ago.`,
      body: `Expiry ${formatDateLong(next.expiryDate!)}.`,
      checked: `Checked ${ctx.documents.length} documents`,
      link: { label: 'Documents', href: '/documents' },
    };
  }

  if (/cost per (km|kilomet|mile)|per km/.test(lower)) {
    const cpk = costPerKm(recs);
    return {
      lead: cpk ? `${ctx.currency} ${cpk.toFixed(2)} per km is what ${scopeName(ctx)} has cost so far.` :`There is not enough distance on record to work out cost per km for ${scopeName(ctx)}.`,
      body: cpk ? `${money(sumAmount(recs))} across ${formatNumber(recs.length)} records.` : 'Log an odometer reading with your next fill and it will appear.',
      checked: `Checked ${recs.length} records`,
      link: { label: 'Insights', href: '/insights' },
    };
  }

  if (/service/.test(lower) && /(history|last|when|due)/.test(lower)) {
    const services = recs.filter((r) => r.type === 'service' || r.type === 'repair').sort((a, b) => (a.date < b.date ? 1 : -1));
    const due = ctx.reminders.find((r) => r.kind === 'service-due' && (!ctx.vehicle || r.vehicleId === ctx.vehicle.id));
    if (services.length === 0) {
      return { lead: `No service on record for ${scopeName(ctx)} yet.`, body: due ? `Next: ${due.description}.` : undefined };
    }
    const last = services[0];
    return {
      lead: `Last serviced ${formatDateLong(last.date)}${last.place ? ` at ${last.place}` : ''}, ${money(last.amount)}.`,
      body: `${services.length} service and repair record${services.length === 1 ? '' : 's'} in total.${due ? ` Next: ${due.description}.` : ''}`,
      checked: `Checked ${recs.length} records`,
      link: ctx.vehicle ? { label: 'Open the timeline', href: `/vehicle/${ctx.vehicle.id}/timeline` } : undefined,
    };
  }

  if (/remind/.test(lower)) {
    const list = ctx.reminders.filter((r) => !r.resolved);
    return {
      lead: list.length ? `${list.length} reminder${list.length === 1 ? '' : 's'} set.` : 'No reminders set.',
      body: list.slice(0, 4).map((r) => r.description).join(' · ') || undefined,
      link: { label: 'Reminders', href: '/reminders' },
    };
  }

  if (/(spend|spent|cost|money)/.test(lower)) {
    const period = /year|20\d\d/.test(lower) ? 'year' : 'month';
    const rows = periodRecords(recs, period, now);
    const total = sumAmount(rows);
    const top = spendSegments(rows).sort((a, b) => b.value - a.value)[0];
    const months = monthByMonth(recs, now);
    return {
      lead: `${money(total)} on ${scopeName(ctx)} this ${period}.`,
      body: top && top.value > 0 ? `${top.label.charAt(0) + top.label.slice(1).toLowerCase()} is the biggest share at ${money(top.value)}. ${period === 'year' ? `That is about ${money(total / Math.max(1, months.length))} a month.` : ''}` : undefined,
      checked: `Checked ${recs.length} records`,
      link: { label: 'Where the money went', href: '/insights' },
    };
  }

  return {
    lead: 'I can answer from your own records.',
    body: 'Ask what you spent, when a document expires, what a car costs per km, or describe a fill-up or service and I will draft the record.',
  };
}

/** The suggestions shown above the composer on Home. */
export function ownerSuggestions(vehicle?: Vehicle): string[] {
  const name = vehicle?.model ?? 'the car';
  return ['Fuel this month', 'When is insurance due', `What has the ${name} cost per km`, 'Service history', 'Reminders I have set'];
}
