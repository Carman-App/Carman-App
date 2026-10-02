"use client";

import { useActionState, useState } from "react";
import { revealMaskedAmount, type RevealState } from "@/lib/privacy/reveal-actions";

/**
 * PRIV-05 masking + reveal-with-reason. Display-only: the real, formatted
 * value is passed in as `value` (already fetched/rendered server-side —
 * this never re-fetches or changes what data is loaded), just not shown
 * until an admin types a reason and confirms. On confirm, writes an audit
 * log entry (via the revealMaskedAmount server action) recording who
 * revealed which record's amount and why, then reveals `value` in place.
 * Never mutates the underlying Payment/Invoice/RefundCredit/FailedPayment
 * row — this is a UI/audit-log concern only.
 */
export function MaskedMoney({
  value,
  currency,
  entityType,
  entityId,
  targetAccountId,
  fieldLabel = "amount",
}: {
  /** Already-formatted real value, e.g. "KES 4,500.00". */
  value: string;
  currency: string;
  entityType: string;
  entityId: string;
  targetAccountId?: string | null;
  fieldLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<RevealState, FormData>(revealMaskedAmount, undefined);

  if (state?.ok) {
    return <span>{value}</span>;
  }

  if (!open) {
    return (
      <span className="inline-flex items-center gap-2">
        <span className="tracking-widest text-neutral-500" title="Masked — reveal requires a stated reason">
          {currency} •••
        </span>
        <button type="button" onClick={() => setOpen(true)} className="text-xs text-sky-600 hover:underline">
          Reveal
        </button>
      </span>
    );
  }

  return (
    <form action={formAction} className="flex flex-col items-start gap-1">
      <input type="hidden" name="entityType" value={entityType} />
      <input type="hidden" name="entityId" value={entityId} />
      <input type="hidden" name="fieldLabel" value={fieldLabel} />
      {targetAccountId && <input type="hidden" name="targetAccountId" value={targetAccountId} />}
      <input
        name="reason"
        placeholder="Reason for revealing"
        required
        className="w-40 rounded border border-neutral-300 bg-white px-1.5 py-0.5 text-xs text-neutral-900"
      />
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-carma-600 px-1.5 py-0.5 text-xs font-medium text-white hover:bg-carma-700 disabled:opacity-60"
        >
          {pending ? "…" : "Confirm"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="text-xs text-neutral-500 hover:underline">
          Cancel
        </button>
      </div>
      {state?.error && <p className="text-xs text-red-600">{state.error}</p>}
    </form>
  );
}
