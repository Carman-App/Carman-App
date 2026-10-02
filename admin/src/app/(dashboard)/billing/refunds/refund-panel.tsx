"use client";

import { useActionState, useState } from "react";
import { requestRefund, approveRefund, rejectRefund, type ActionState } from "../refund-actions";
import { formatDateTime } from "@/lib/format";

export type RefundableSubscription = {
  id: string;
  currency: string;
  partyLabel: string;
  planPriceCentsLabel: string;
};

export function RequestRefundPanel({ options }: { options: RefundableSubscription[] }) {
  const [step, setStep] = useState<0 | 1>(0);
  const [subscriptionId, setSubscriptionId] = useState("");
  const [type, setType] = useState<"REFUND" | "CREDIT">("REFUND");
  const [amount, setAmount] = useState("");
  const [full, setFull] = useState(false);
  const [reason, setReason] = useState("");
  const [state, formAction, pending] = useActionState<ActionState, FormData>(requestRefund, undefined);

  const selected = options.find((o) => o.id === subscriptionId);

  if (options.length === 0) {
    return <p className="text-sm text-neutral-500">No subscription exists to refund or credit against.</p>;
  }

  if (step === 0) {
    return (
      <div className="space-y-3 rounded border border-neutral-200 p-4">
        <div>
          <label className="block text-xs text-neutral-500">Subscription (required)</label>
          <select
            required
            value={subscriptionId}
            onChange={(e) => setSubscriptionId(e.target.value)}
            className="mt-1 w-full rounded border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900"
          >
            <option value="" disabled>
              Pick a subscription…
            </option>
            {options.map((o) => (
              <option key={o.id} value={o.id}>
                {o.partyLabel} — plan price {o.planPriceCentsLabel} ({o.currency})
              </option>
            ))}
          </select>
        </div>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 text-sm text-neutral-700">
            <input type="radio" checked={type === "REFUND"} onChange={() => setType("REFUND")} /> Refund
          </label>
          <label className="flex items-center gap-2 text-sm text-neutral-700">
            <input type="radio" checked={type === "CREDIT"} onChange={() => setType("CREDIT")} /> Credit
          </label>
        </div>
        <div>
          <label className="block text-xs text-neutral-500">
            Amount ({selected?.currency ?? "select a subscription first"}) — enter what was actually
            charged; there is no processor charge ledger to pull this from automatically
          </label>
          <input
            type="number"
            min="0.01"
            step="0.01"
            required
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="mt-1 w-full rounded border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-neutral-700">
          <input type="checkbox" checked={full} onChange={(e) => setFull(e.target.checked)} /> This is a full
          refund/credit (not partial)
        </label>
        <div>
          <label className="block text-xs text-neutral-500">Reason (required)</label>
          <textarea
            required
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="mt-1 w-full rounded border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900"
          />
        </div>
        <button
          type="button"
          disabled={!subscriptionId || !amount || !reason}
          onClick={() => setStep(1)}
          className="rounded-full bg-carma-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-carma-700 disabled:opacity-40"
        >
          Continue →
        </button>
      </div>
    );
  }

  const amountLabel = `${Number(amount).toFixed(2)} ${selected?.currency ?? ""}`;

  return (
    <form action={formAction} className="space-y-3 rounded border border-amber-200 bg-amber-50 p-4">
      <input type="hidden" name="subscriptionId" value={subscriptionId} />
      <input type="hidden" name="type" value={type} />
      <input type="hidden" name="amount" value={amount} />
      {full && <input type="hidden" name="full" value="on" />}
      <input type="hidden" name="reason" value={reason} />

      <p className="text-sm font-medium text-amber-800">
        Confirm: {amountLabel} {type.toLowerCase()} to {selected?.partyLabel}
        {full ? " (full)" : " (partial)"}
      </p>
      <p className="text-xs text-neutral-600">Reason: &ldquo;{reason}&rdquo;</p>
      <p className="text-xs text-neutral-500">
        No payment processor is connected — this records the admin decision only; no real money will
        move. If this amount is at or above $100-equivalent, or at or above 50% of the plan&rsquo;s
        monthly price, it will instead be filed as a pending request needing a second FINANCE/OWNER
        admin&rsquo;s approval.
      </p>

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-500 disabled:opacity-60"
        >
          {pending ? "Submitting…" : `Yes — ${amountLabel} ${type.toLowerCase()} to ${selected?.partyLabel}`}
        </button>
        <button
          type="button"
          onClick={() => setStep(0)}
          className="rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-600 hover:border-neutral-500"
        >
          Back
        </button>
      </div>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state?.message && <p className="text-sm text-emerald-600">{state.message}</p>}
    </form>
  );
}

export type PendingRefundApproval = {
  approvalId: string;
  refundCreditId: string;
  requestedAt: Date;
  requestedByLabel: string;
  requestedByAdminId: string;
  reasonLine: string; // includes the amount+party the request action embedded
};

export function PendingRefundApprovalCard({
  approval,
  currentAdminId,
}: {
  approval: PendingRefundApproval;
  currentAdminId: string;
}) {
  const [approveState, approveAction, approvePending] = useActionState<ActionState, FormData>(approveRefund, undefined);
  const [rejectState, rejectAction, rejectPending] = useActionState<ActionState, FormData>(rejectRefund, undefined);
  const [showReject, setShowReject] = useState(false);
  const isRequester = approval.requestedByAdminId === currentAdminId;

  return (
    <div className="space-y-3 rounded border border-amber-200 bg-amber-50 p-4">
      <p className="text-sm text-amber-800">Pending approval — {approval.reasonLine}</p>
      <p className="text-xs text-neutral-600">
        Requested {formatDateTime(approval.requestedAt)} by {approval.requestedByLabel}
      </p>

      {isRequester ? (
        <p className="text-xs text-neutral-500">You requested this — a different admin must approve it.</p>
      ) : (
        <form action={approveAction}>
          <input type="hidden" name="approvalId" value={approval.approvalId} />
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
      {approveState?.message && <p className="text-sm text-emerald-600">{approveState.message}</p>}

      {!showReject ? (
        <button type="button" onClick={() => setShowReject(true)} className="text-xs text-neutral-500 hover:text-neutral-700">
          Reject this request
        </button>
      ) : (
        <form action={rejectAction} className="space-y-2">
          <input type="hidden" name="approvalId" value={approval.approvalId} />
          <input type="hidden" name="refundCreditId" value={approval.refundCreditId} />
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
