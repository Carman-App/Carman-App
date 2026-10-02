import { addRecord } from '@/data/repo';
import type { PendingDraft } from '@/features/assistant/draftStore';
import type { Vehicle, VehicleRecord } from '@/types/domain';

/** The VehicleRecord a draft becomes. Category details are folded into notes so nothing typed is lost. */
export function draftToRecord(d: PendingDraft, vehicle: Vehicle, enteredBy: string): Omit<VehicleRecord, 'id' | 'vehicleId'> {
  const detailLines = (d.details ?? []).filter((x) => x.value.trim()).map((x) => `${x.label}: ${x.value.trim()}`);
  const notes = [d.title, ...detailLines, d.origin === 'assistant' ? d.notes : undefined].filter(Boolean).join('\n') || undefined;
  return {
    type: d.kind,
    date: d.date,
    amount: d.kind === 'odometer' ? 0 : (d.amount ?? 0),
    odometerAtEntry: d.odometer ?? vehicle.odometerKm,
    place: d.place?.trim() || undefined,
    litres: d.litres,
    enteredByMemberName: enteredBy,
    category: d.category,
    notes,
  };
}

export async function saveDraft(d: PendingDraft, vehicle: Vehicle, enteredBy: string) {
  return addRecord(vehicle.id, draftToRecord(d, vehicle, enteredBy));
}

/** What is still missing before a draft can be saved. */
export function draftGaps(d: PendingDraft): string[] {
  const gaps: string[] = [];
  if (!d.vehicleId) gaps.push('vehicle');
  if (d.kind === 'odometer') {
    if (!d.odometer) gaps.push('odometer');
  } else if (!d.amount || d.amount <= 0) gaps.push('amount');
  return gaps;
}
