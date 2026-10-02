"use client";

import { useActionState, useState } from "react";
import { approveRequest, rejectRequest, type ActionState } from "./actions";

export function ApprovalRowActions({ approvalId, ownRequest }: { approvalId: string; ownRequest: boolean }) {
  const [rejecting, setRejecting] = useState(false);
  const [approveState, approveAction, approving] = useActionState<ActionState, FormData>(approveRequest, undefined);
  const [rejectState, rejectAction, rejectPending] = useActionState<ActionState, FormData>(rejectRequest, undefined);
  const state = approveState ?? rejectState;

  if (state?.ok) return <p className="text-xs text-emerald-700">{state.message}</p>;
  if (ownRequest) return <p className="text-xs text-neutral-500">Your request. Another admin decides it.</p>;

  return (
    <div className="space-y-2">
      {rejecting ? (
        <form action={rejectAction} className="space-y-2">
          <input type="hidden" name="approvalId" value={approvalId} />
          <textarea
            name="reason"
            required
            rows={2}
            placeholder="Why it should not go ahead"
            className="w-full rounded border border-neutral-300 bg-white px-2 py-1 text-xs text-neutral-900"
          />
          <div className="flex gap-2">
            <button type="submit" disabled={rejectPending} className="rounded-full border border-red-300 px-3 py-1 text-xs font-medium text-red-700 disabled:opacity-60">
              {rejectPending ? "Rejecting…" : "Confirm reject"}
            </button>
            <button type="button" onClick={() => setRejecting(false)} className="rounded-full border border-neutral-300 px-3 py-1 text-xs text-neutral-600">
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div className="flex gap-2">
          <form action={approveAction}>
            <input type="hidden" name="approvalId" value={approvalId} />
            <button type="submit" disabled={approving} className="rounded-full bg-carma-600 px-3 py-1 text-xs font-medium text-white hover:bg-carma-700 disabled:opacity-60">
              {approving ? "Carrying out…" : "Approve and carry out"}
            </button>
          </form>
          <button type="button" onClick={() => setRejecting(true)} className="rounded-full border border-neutral-300 px-3 py-1 text-xs text-neutral-700 hover:border-neutral-500">
            Reject
          </button>
        </div>
      )}
      {state?.error && <p className="text-xs text-red-600">{state.error}</p>}
    </div>
  );
}
