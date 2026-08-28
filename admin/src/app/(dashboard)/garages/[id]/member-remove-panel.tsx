"use client";

import { useActionState, useState } from "react";
import { removeMember, type ActionState } from "./actions";

export type RemovableMember = { id: string; label: string };

export function MemberRemovePanel({ members }: { members: RemovableMember[] }) {
  const [step, setStep] = useState<0 | 1>(0);
  const [state, formAction, pending] = useActionState<ActionState, FormData>(removeMember, undefined);

  if (members.length === 0) {
    return <p className="text-sm text-neutral-500">No current members to remove.</p>;
  }

  if (step === 0) {
    return (
      <button
        type="button"
        onClick={() => setStep(1)}
        className="rounded border border-red-200 px-3 py-1.5 text-sm text-red-700 hover:border-red-400"
      >
        Remove a member
      </button>
    );
  }

  return (
    <form action={formAction} className="space-y-3 rounded border border-red-200 bg-red-50 p-4">
      <div>
        <label className="block text-xs text-neutral-500">Member (required)</label>
        <select
          name="memberId"
          required
          defaultValue=""
          className="mt-1 w-full rounded border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900"
        >
          <option value="" disabled>
            Pick a member…
          </option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs text-neutral-500">Reason (required)</label>
        <textarea
          name="reason"
          required
          rows={2}
          className="mt-1 w-full rounded border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900"
          placeholder="Why this member is being removed"
        />
      </div>
      <p className="rounded border border-neutral-200 bg-neutral-100 px-3 py-2 text-xs text-neutral-600">
        This does not delete their membership row — it stamps a removal date/reason/admin so they
        show up as a former member with full history retained.
      </p>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-60"
        >
          {pending ? "Removing…" : "Yes, remove"}
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
      {state?.ok && state.message && <p className="text-sm text-emerald-600">{state.message}</p>}
    </form>
  );
}
