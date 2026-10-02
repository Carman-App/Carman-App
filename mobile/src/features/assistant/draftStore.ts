/**
 * Hand-off store for the assistant flow: Home → Answer (draft) → Review →
 * What will change → saved. The draft lives in memory only, so abandoning the
 * flow leaves nothing behind, which is the design's "Nothing saved yet".
 */
import { useSyncExternalStore } from 'react';

import type { Draft } from '@/features/assistant/engine';

export type PendingDraft = Draft & {
  vehicleId?: string;
  date: string;
  /** Free-text title for the record ("Front pads and discs"). */
  title?: string;
  /** The record-selector category this draft came from ("insurance", "parking"...). */
  categoryKey?: string;
  /** Category-specific detail fields from the form (Insurer, Policy number...). Saved into the record's notes. */
  details?: { label: string; value: string }[];
  /** Where the draft started, for Review's header. */
  origin?: 'assistant' | 'form' | 'scan';
};

let current: PendingDraft | null = null;
const listeners = new Set<() => void>();

export function setDraft(next: PendingDraft | null) {
  current = next;
  listeners.forEach((l) => l());
}

export function patchDraft(patch: Partial<PendingDraft>) {
  if (!current) return;
  setDraft({ ...current, ...patch, sources: { ...current.sources, ...(patch.sources ?? {}) } });
}

export function getDraft() {
  return current;
}

export function useDraft() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => current,
    () => current
  );
}
