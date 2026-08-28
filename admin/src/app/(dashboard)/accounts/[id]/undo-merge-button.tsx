"use client";

import { useState } from "react";
import { undoMerge } from "./merge/actions";

export function UndoMergeButton({ mergeId }: { mergeId: string }) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs text-amber-400 hover:underline"
      >
        Undo this merge
      </button>
    );
  }

  return (
    <form action={undoMerge} className="mt-2 space-y-2 rounded border border-amber-900/50 bg-amber-950/10 p-3">
      <input type="hidden" name="mergeId" value={mergeId} />
      <label className="block text-xs text-neutral-500">Reason for undoing (required)</label>
      <textarea
        name="reason"
        required
        rows={2}
        className="w-full rounded border border-neutral-700 bg-neutral-950 px-2 py-1 text-sm text-neutral-100"
      />
      <div className="flex gap-2">
        <button
          type="submit"
          className="rounded bg-amber-600 px-3 py-1 text-xs font-medium text-white hover:bg-amber-500"
        >
          Yes, undo merge
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded border border-neutral-700 px-3 py-1 text-xs text-neutral-400"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
