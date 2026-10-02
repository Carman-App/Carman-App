"use client";

import { useActionState, useState } from "react";
import { approveSubmission, rejectSubmission, mergeSubmission, type ActionState } from "./actions";

export function ReviewControls({ submissionId }: { submissionId: string }) {
  const [mode, setMode] = useState<"idle" | "reject" | "merge">("idle");
  const [approveState, approveAction, approvePending] = useActionState<ActionState, FormData>(approveSubmission, undefined);
  const [rejectState, rejectAction, rejectPending] = useActionState<ActionState, FormData>(rejectSubmission, undefined);
  const [mergeState, mergeAction, mergePending] = useActionState<ActionState, FormData>(mergeSubmission, undefined);

  if (mode === "reject") {
    return (
      <form action={rejectAction} className="space-y-2">
        <input type="hidden" name="submissionId" value={submissionId} />
        <textarea
          name="reviewNote"
          required
          rows={2}
          placeholder="Reason for rejecting (required)"
          className="w-full rounded border border-neutral-300 bg-white px-2 py-1 text-xs text-neutral-900"
        />
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={rejectPending}
            className="rounded bg-red-700 px-2 py-1 text-xs text-white hover:bg-red-600 disabled:opacity-60"
          >
            {rejectPending ? "Rejecting…" : "Confirm reject"}
          </button>
          <button
            type="button"
            onClick={() => setMode("idle")}
            className="rounded border border-neutral-300 px-2 py-1 text-xs text-neutral-600 hover:border-neutral-500"
          >
            Cancel
          </button>
        </div>
        {rejectState?.error && <p className="text-xs text-red-600">{rejectState.error}</p>}
      </form>
    );
  }

  if (mode === "merge") {
    return (
      <form action={mergeAction} className="space-y-2">
        <input type="hidden" name="submissionId" value={submissionId} />
        <div className="grid grid-cols-2 gap-2">
          <input
            name="mergedIntoMake"
            required
            placeholder="Existing make"
            className="rounded border border-neutral-300 bg-white px-2 py-1 text-xs text-neutral-900"
          />
          <input
            name="mergedIntoModel"
            required
            placeholder="Existing model"
            className="rounded border border-neutral-300 bg-white px-2 py-1 text-xs text-neutral-900"
          />
        </div>
        <textarea
          name="reviewNote"
          rows={2}
          placeholder="Note (optional)"
          className="w-full rounded border border-neutral-300 bg-white px-2 py-1 text-xs text-neutral-900"
        />
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={mergePending}
            className="rounded-full bg-carma-600 px-2 py-1 text-xs font-medium text-white hover:bg-carma-700 disabled:opacity-60"
          >
            {mergePending ? "Merging…" : "Confirm merge"}
          </button>
          <button
            type="button"
            onClick={() => setMode("idle")}
            className="rounded border border-neutral-300 px-2 py-1 text-xs text-neutral-600 hover:border-neutral-500"
          >
            Cancel
          </button>
        </div>
        {mergeState?.error && <p className="text-xs text-red-600">{mergeState.error}</p>}
      </form>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      <form action={approveAction}>
        <input type="hidden" name="submissionId" value={submissionId} />
        <button
          type="submit"
          disabled={approvePending}
          className="rounded bg-emerald-700 px-2 py-1 text-xs text-white hover:bg-emerald-600 disabled:opacity-60"
        >
          {approvePending ? "Approving…" : "Approve"}
        </button>
      </form>
      <button
        type="button"
        onClick={() => setMode("reject")}
        className="rounded border border-red-200 px-2 py-1 text-xs text-red-700 hover:border-red-400"
      >
        Reject
      </button>
      <button
        type="button"
        onClick={() => setMode("merge")}
        className="rounded border border-neutral-300 px-2 py-1 text-xs text-neutral-700 hover:border-neutral-500"
      >
        Merge into existing
      </button>
      {approveState?.error && <p className="text-xs text-red-600">{approveState.error}</p>}
    </div>
  );
}
