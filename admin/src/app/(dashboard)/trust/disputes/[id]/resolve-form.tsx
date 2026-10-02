"use client";

import { useActionState, useState } from "react";
import { resolveDispute, type ActionState } from "../actions";

export function ResolveForm({ disputeId }: { disputeId: string }) {
  const [outcome, setOutcome] = useState<"RESOLVED" | "DISMISSED">("RESOLVED");
  const [state, formAction, pending] = useActionState<ActionState, FormData>(resolveDispute, undefined);

  return (
    <form action={formAction} className="space-y-3 rounded border border-neutral-200 p-4">
      <input type="hidden" name="disputeId" value={disputeId} />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setOutcome("RESOLVED")}
          className={`rounded border px-3 py-1.5 text-sm ${
            outcome === "RESOLVED" ? "border-emerald-400 bg-emerald-100 text-emerald-800" : "border-neutral-300 text-neutral-700"
          }`}
        >
          Resolved
        </button>
        <button
          type="button"
          onClick={() => setOutcome("DISMISSED")}
          className={`rounded border px-3 py-1.5 text-sm ${
            outcome === "DISMISSED" ? "border-neutral-500 bg-neutral-50 text-neutral-900" : "border-neutral-300 text-neutral-700"
          }`}
        >
          Dismissed
        </button>
      </div>
      <input type="hidden" name="outcome" value={outcome} />
      <div>
        <label className="block text-xs text-neutral-500">Resolution note (required)</label>
        <textarea
          name="resolutionNote"
          required
          rows={3}
          className="mt-1 w-full rounded border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-carma-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-carma-700 disabled:opacity-60"
      >
        {pending ? "Saving…" : `Confirm ${outcome.toLowerCase()}`}
      </button>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
    </form>
  );
}
