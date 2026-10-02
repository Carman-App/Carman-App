"use client";

import { useActionState } from "react";
import { upsertPlanPrice, deletePlanPrice, type ActionState } from "../actions";

export function NewPriceForm({ planId }: { planId: string }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(upsertPlanPrice, undefined);
  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2 rounded border border-neutral-200 p-3">
      <input type="hidden" name="planId" value={planId} />
      <div>
        <label className="block text-xs text-neutral-500">Currency</label>
        <input
          name="currency"
          required
          placeholder="e.g. KES"
          className="mt-1 w-24 rounded border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900 uppercase"
        />
      </div>
      <div>
        <label className="block text-xs text-neutral-500">Price (cents)</label>
        <input
          name="priceCents"
          type="number"
          min={0}
          required
          className="mt-1 w-32 rounded border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-carma-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-carma-700 disabled:opacity-60"
      >
        {pending ? "Saving…" : "Add / update price"}
      </button>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state?.ok && <p className="text-sm text-emerald-600">{state.message}</p>}
    </form>
  );
}

export function DeletePriceButton({ priceId }: { priceId: string }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(deletePlanPrice, undefined);
  return (
    <form action={formAction} className="inline-block">
      <input type="hidden" name="priceId" value={priceId} />
      <button
        type="submit"
        disabled={pending}
        className="rounded border border-red-200 px-2 py-1 text-xs text-red-700 hover:border-red-400 disabled:opacity-60"
      >
        {pending ? "Removing…" : "Remove"}
      </button>
      {state?.error && <p className="text-xs text-red-600">{state.error}</p>}
    </form>
  );
}
