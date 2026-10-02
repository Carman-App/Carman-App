import type { VehicleRecord } from '@/types/domain';

/** The one-line name a record shows in lists ("Fuel · 46.2 L", "Front brake pads replaced"). */
export function recordTitle(r: VehicleRecord) {
  const firstNote = r.notes?.split('\n')[0];
  if (r.type === 'fuel') return r.litres ? `Fuel · ${r.litres} L` : 'Fuel';
  if (r.type === 'service') return firstNote || 'Service';
  if (r.type === 'repair') return firstNote || 'Repair';
  if (r.type === 'part') return firstNote || 'Part';
  if (r.type === 'odometer') return 'Odometer reading';
  if (r.category === 'insurance') return 'Insurance';
  if (r.category === 'loan') return 'Loan instalment';
  return firstNote || 'Expense';
}

/** Newest first; same-day records by odometer, highest first. */
export function sortRecords(rows: VehicleRecord[] | undefined) {
  return [...(rows ?? [])].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.odometerAtEntry - a.odometerAtEntry));
}
