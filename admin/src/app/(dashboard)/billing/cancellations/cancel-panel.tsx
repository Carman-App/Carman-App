"use client";

import { useActionState, useState } from "react";
import { cancelSubscription, type ActionState } from "./actions";
import { CancellationReason } from "@/generated/prisma/enums";
import { titleCase } from "@/lib/format";

const REASONS = Object.values(CancellationReason) as CancellationReason[];

export type CancellableSubscription = { id: string; label: string };

export function CancelPanel({ options }: { options: CancellableSubscription[] }) {
  const [step, setStep] = useState<0 | 1>(0);
  const [state, formAction, pending] = useActionState<ActionState, FormData>(cancelSubscription, undefined);

  if (options.length === 0) {
    return <p className="text-sm text-neutral-500">No cancellable (non-CANCELED) subscription exists.</p>;
  }

  if (step === 0) {
    return (
      <button
        type="button"
        onClick={() => setStep(1)}
        className="rounded border border-red-200 px-3 py-1.5 text-sm text-red-700 hover:border-red-400"
      >
        Record a cancellation
      </button>
    );
  }

  return (
    <form action={formAction} className="space-y-3 rounded border border-red-200 bg-red-50 p-4">
      <p className="text-xs text-neutral-500">
        For a customer who asked support to cancel — there is no self-serve cancel flow yet, so this
        is how a cancellation gets recorded on their behalf.
      </p>
      <div>
        <label className="block text-xs text-neutral-500">Subscription (required)</label>
        <select
          name="subscriptionId"
          required
          defaultValue=""
          className="mt-1 w-full rounded border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900"
        >
          <option value="" disabled>
            Pick a subscription…
          </option>
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs text-neutral-500">Cancellation reason (required)</label>
        <select
          name="cancellationReason"
          required
          defaultValue=""
          className="mt-1 w-full rounded border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900"
        >
          <option value="" disabled>
            Pick a reason…
          </option>
          {REASONS.map((r) => (
            <option key={r} value={r}>
              {titleCase(r)}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs text-neutral-500">Note (required)</label>
        <textarea
          name="note"
          required
          rows={2}
          className="mt-1 w-full rounded border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900"
          placeholder="Details for the record"
        />
      </div>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-60"
        >
          {pending ? "Cancelling…" : "Confirm cancellation"}
        </button>
        <button
          type="button"
          onClick={() => setStep(0)}
          className="rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-600 hover:border-neutral-500"
        >
          Cancel
        </button>
      </div>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state?.message && <p className="text-sm text-emerald-600">{state.message}</p>}
    </form>
  );
}
