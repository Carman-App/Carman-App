"use client";

import { useActionState, useState } from "react";
import {
  requestGarageTransfer,
  approveGarageTransfer,
  rejectGarageTransfer,
  type ActionState,
} from "./actions";
import { formatDateTime } from "@/lib/format";

export type TransferMemberOption = { accountId: string; label: string };

export type PendingTransfer = {
  id: string;
  requestedAt: Date;
  requestedByAdminId: string;
  requestedByLabel: string;
  reason: string;
  newOwnerAccountId: string;
  newOwnerLabel: string;
};

export function TransferPanel({
  garageId,
  currentOwnerLabel,
  memberOptions,
  pendingTransfers,
  currentAdminId,
}: {
  garageId: string;
  currentOwnerLabel: string;
  memberOptions: TransferMemberOption[];
  pendingTransfers: PendingTransfer[];
  currentAdminId: string;
}) {
  return (
    <div className="space-y-4">
      <p className="text-xs text-neutral-500">
        Current owner: <span className="text-neutral-700">{currentOwnerLabel}</span>. Handing over
        ownership requires a reason and a second OWNER-role admin&rsquo;s approval — the admin who
        requests it cannot also approve it.
      </p>

      {pendingTransfers.map((t) => (
        <PendingTransferCard
          key={t.id}
          garageId={garageId}
          transfer={t}
          isRequester={t.requestedByAdminId === currentAdminId}
        />
      ))}

      {pendingTransfers.length === 0 && <RequestForm garageId={garageId} memberOptions={memberOptions} />}
    </div>
  );
}

function RequestForm({ garageId, memberOptions }: { garageId: string; memberOptions: TransferMemberOption[] }) {
  const [step, setStep] = useState<0 | 1>(0);
  const [state, formAction, pending] = useActionState<ActionState, FormData>(requestGarageTransfer, undefined);

  if (memberOptions.length === 0) {
    return (
      <p className="text-sm text-neutral-500">
        No other current member exists yet to hand this garage over to.
      </p>
    );
  }

  if (step === 0) {
    return (
      <button
        type="button"
        onClick={() => setStep(1)}
        className="rounded border border-amber-200 px-3 py-1.5 text-sm text-amber-700 hover:border-amber-400"
      >
        Request ownership handover
      </button>
    );
  }

  return (
    <form action={formAction} className="space-y-3 rounded border border-amber-200 bg-amber-50 p-4">
      <input type="hidden" name="garageId" value={garageId} />
      <div>
        <label className="block text-xs text-neutral-500">New owner — existing member (required)</label>
        <select
          name="newOwnerAccountId"
          required
          defaultValue=""
          className="mt-1 w-full rounded border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900"
        >
          <option value="" disabled>
            Pick a member…
          </option>
          {memberOptions.map((m) => (
            <option key={m.accountId} value={m.accountId}>
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
          placeholder="Why this garage is changing hands"
        />
      </div>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-500 disabled:opacity-60"
        >
          {pending ? "Requesting…" : "Request handover"}
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
    </form>
  );
}

function PendingTransferCard({
  garageId,
  transfer,
  isRequester,
}: {
  garageId: string;
  transfer: PendingTransfer;
  isRequester: boolean;
}) {
  const [approveState, approveAction, approvePending] = useActionState<ActionState, FormData>(
    approveGarageTransfer,
    undefined,
  );
  const [rejectState, rejectAction, rejectPending] = useActionState<ActionState, FormData>(
    rejectGarageTransfer,
    undefined,
  );
  const [showReject, setShowReject] = useState(false);

  return (
    <div className="space-y-3 rounded border border-amber-200 bg-amber-50 p-4">
      <p className="text-sm text-amber-800">
        Pending: hand over to <span className="font-medium">{transfer.newOwnerLabel}</span>
      </p>
      <p className="text-xs text-neutral-600">
        Requested {formatDateTime(transfer.requestedAt)} by {transfer.requestedByLabel} — &ldquo;
        {transfer.reason}&rdquo;
      </p>

      {isRequester ? (
        <p className="text-xs text-neutral-500">
          You requested this — a different OWNER-role admin must approve it.
        </p>
      ) : (
        <form action={approveAction}>
          <input type="hidden" name="approvalId" value={transfer.id} />
          <input type="hidden" name="garageId" value={garageId} />
          <button
            type="submit"
            disabled={approvePending}
            className="rounded bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-500 disabled:opacity-60"
          >
            {approvePending ? "Approving…" : "Approve & execute"}
          </button>
        </form>
      )}
      {approveState?.error && <p className="text-sm text-red-600">{approveState.error}</p>}

      {!showReject ? (
        <button
          type="button"
          onClick={() => setShowReject(true)}
          className="text-xs text-neutral-500 hover:text-neutral-700"
        >
          Reject this request
        </button>
      ) : (
        <form action={rejectAction} className="space-y-2">
          <input type="hidden" name="approvalId" value={transfer.id} />
          <input type="hidden" name="garageId" value={garageId} />
          <textarea
            name="reason"
            required
            rows={2}
            placeholder="Reason for rejecting (required)"
            className="w-full rounded border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900"
          />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={rejectPending}
              className="rounded border border-red-200 px-3 py-1.5 text-sm text-red-700 hover:border-red-400 disabled:opacity-60"
            >
              {rejectPending ? "Rejecting…" : "Confirm reject"}
            </button>
            <button
              type="button"
              onClick={() => setShowReject(false)}
              className="rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-600 hover:border-neutral-500"
            >
              Cancel
            </button>
          </div>
          {rejectState?.error && <p className="text-sm text-red-600">{rejectState.error}</p>}
        </form>
      )}
    </div>
  );
}
