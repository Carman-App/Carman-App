"use client";

import { useActionState } from "react";
import { stageSubscriptionRulesDraft, type ActionState } from "./actions";

export type SubscriptionRulesFormValues = {
  trialDays: number;
  graceDays: number;
  dunningScheduleDays: number[];
  defaultSeatLimit: number | null;
};

export function SubscriptionRulesForm({ initial }: { initial: SubscriptionRulesFormValues }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(stageSubscriptionRulesDraft, undefined);

  return (
    <form action={formAction} className="space-y-3 rounded border border-neutral-200 p-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-neutral-500">Trial days</label>
          <input
            name="trialDays"
            type="number"
            min={0}
            required
            defaultValue={initial.trialDays}
            className="mt-1 w-full rounded border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900"
          />
        </div>
        <div>
          <label className="block text-xs text-neutral-500">Grace days</label>
          <input
            name="graceDays"
            type="number"
            min={0}
            required
            defaultValue={initial.graceDays}
            className="mt-1 w-full rounded border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900"
          />
        </div>
        <div>
          <label className="block text-xs text-neutral-500">Dunning schedule (days, comma-separated)</label>
          <input
            name="dunningScheduleDays"
            required
            defaultValue={initial.dunningScheduleDays.join(",")}
            placeholder="e.g. 1,3,7"
            className="mt-1 w-full rounded border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900"
          />
        </div>
        <div>
          <label className="block text-xs text-neutral-500">Default seat limit (blank = unlimited)</label>
          <input
            name="defaultSeatLimit"
            type="number"
            min={1}
            defaultValue={initial.defaultSeatLimit ?? ""}
            className="mt-1 w-full rounded border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs text-neutral-500">Note (optional context for this draft)</label>
        <textarea
          name="note"
          rows={2}
          className="mt-1 w-full rounded border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900"
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="rounded bg-neutral-900 px-3 py-1.5 text-sm font-medium text-neutral-100 hover:bg-neutral-800 disabled:opacity-60"
      >
        {pending ? "Staging…" : "Stage draft"}
      </button>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state?.ok && <p className="text-sm text-emerald-600">{state.message}</p>}
    </form>
  );
}
