"use client";

import { useActionState } from "react";
import { upsertRetentionRule, type ActionState } from "./actions";

export function RetentionRuleForm({
  existing,
}: {
  existing?: { dataClass: string; retentionDays: number; description: string | null };
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(upsertRetentionRule, undefined);

  return (
    <form action={formAction} className="space-y-3 rounded border border-neutral-200 p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="block text-xs text-neutral-500">Data class</label>
          <input
            name="dataClass"
            defaultValue={existing?.dataClass}
            readOnly={Boolean(existing)}
            placeholder="e.g. fuel_records"
            required
            className={`mt-1 w-full rounded border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900 ${existing ? "opacity-70" : ""}`}
          />
        </div>
        <div>
          <label className="block text-xs text-neutral-500">Retention (days)</label>
          <input
            type="number"
            name="retentionDays"
            min={1}
            step={1}
            defaultValue={existing?.retentionDays}
            required
            className="mt-1 w-full rounded border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900"
          />
        </div>
      </div>
      <div>
        <label className="block text-xs text-neutral-500">Description</label>
        <input
          name="description"
          defaultValue={existing?.description ?? ""}
          placeholder="What this data class covers"
          className="mt-1 w-full rounded border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900"
        />
      </div>
      <div>
        <label className="block text-xs text-neutral-500">Reason (required)</label>
        <textarea
          name="reason"
          required
          rows={2}
          className="mt-1 w-full rounded border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-carma-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-carma-700 disabled:opacity-60"
      >
        {pending ? "Saving…" : existing ? "Update rule" : "Add rule"}
      </button>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state?.ok && state.message && <p className="text-sm text-emerald-600">{state.message}</p>}
    </form>
  );
}
