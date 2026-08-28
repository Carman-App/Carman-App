"use client";

import { useActionState } from "react";
import { confirmMerge, type MergeFormState } from "./actions";

export function MergeConfirmForm({ primaryId, secondaryId }: { primaryId: string; secondaryId: string }) {
  const [state, action, pending] = useActionState<MergeFormState, FormData>(confirmMerge, undefined);

  return (
    <form action={action} className="space-y-3 rounded border border-red-900/50 bg-red-950/10 p-4">
      <input type="hidden" name="primaryId" value={primaryId} />
      <input type="hidden" name="secondaryId" value={secondaryId} />
      <p className="text-sm text-neutral-200">
        This moves everything listed above from the secondary account to the primary account, in one
        transaction. The secondary account id keeps resolving — it will show a banner pointing here
        instead of its own detail page. This can be undone later from the primary account&rsquo;s
        &ldquo;Recent merges&rdquo; section.
      </p>
      <div>
        <label className="block text-xs text-neutral-500">Reason (required)</label>
        <textarea
          name="reason"
          required
          rows={2}
          className="mt-1 w-full rounded border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100"
          placeholder="Why are these two accounts being merged?"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-60"
      >
        {pending ? "Merging…" : "Yes, merge these accounts"}
      </button>
      {state?.error && (
        <p className="text-sm text-red-400" role="alert">
          {state.error}
        </p>
      )}
    </form>
  );
}
