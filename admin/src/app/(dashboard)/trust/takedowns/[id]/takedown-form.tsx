"use client";

import { useActionState, useState } from "react";
import { takedownDocument, type ActionState } from "../actions";

export function TakedownForm({ documentId }: { documentId: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<ActionState, FormData>(takedownDocument, undefined);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded border border-red-200 px-3 py-1.5 text-sm text-red-700 hover:border-red-400"
      >
        Take down this image
      </button>
    );
  }

  return (
    <form action={formAction} className="space-y-3 rounded border border-red-200 bg-red-50 p-4">
      <input type="hidden" name="documentId" value={documentId} />
      <p className="text-sm text-neutral-800">
        The file is replaced with a placeholder; the document row (title, expiry, vehicle link)
        stays exactly as-is, and the original object key is preserved (not deleted) in case it&rsquo;s
        needed again.
      </p>
      <div>
        <label className="block text-xs text-neutral-500">Reason (required)</label>
        <textarea
          name="reason"
          required
          rows={2}
          className="mt-1 w-full rounded border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900"
        />
      </div>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-60"
        >
          {pending ? "Taking down…" : "Confirm takedown"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-600 hover:border-neutral-500"
        >
          Cancel
        </button>
      </div>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state?.ok && <p className="text-sm text-emerald-600">{state.message}</p>}
    </form>
  );
}
