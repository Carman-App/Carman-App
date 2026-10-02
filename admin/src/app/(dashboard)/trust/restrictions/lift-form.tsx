"use client";

import { useActionState, useState } from "react";
import { liftRestriction, type ActionState } from "./actions";

export function LiftForm({ restrictionId }: { restrictionId: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<ActionState, FormData>(liftRestriction, undefined);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded border border-neutral-300 px-2 py-1 text-xs text-neutral-800 hover:border-neutral-500"
      >
        Lift early
      </button>
    );
  }

  return (
    <form action={formAction} className="space-y-2 rounded border border-neutral-200 p-2">
      <input type="hidden" name="restrictionId" value={restrictionId} />
      <textarea
        name="reason"
        required
        rows={2}
        placeholder="Reason for lifting early"
        className="w-full rounded border border-neutral-300 bg-white px-2 py-1 text-xs text-neutral-900"
      />
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-carma-600 px-2 py-1 text-xs font-medium text-white hover:bg-carma-700 disabled:opacity-60"
        >
          {pending ? "Saving…" : "Confirm lift"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="rounded border border-neutral-300 px-2 py-1 text-xs text-neutral-600">
          Cancel
        </button>
      </div>
      {state?.error && <p className="text-xs text-red-600">{state.error}</p>}
    </form>
  );
}
