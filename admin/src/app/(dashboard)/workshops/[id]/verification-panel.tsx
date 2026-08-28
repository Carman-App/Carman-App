"use client";

import { useActionState, useState } from "react";
import { grantVerification, revokeVerification, type ActionState } from "./verification-actions";
import { formatDateTime } from "@/lib/format";

export type VerificationHistoryRow = {
  id: string;
  action: "GRANTED" | "REVOKED";
  reason: string | null;
  effectiveAt: Date;
  checkedItems: unknown;
  documentKeys: string[];
  performedByAdminId: string;
  createdAt: Date;
};

function todayInputValue(): string {
  return new Date().toISOString().slice(0, 10);
}

export function VerificationPanel({
  workshopId,
  verifiedBadge,
  verifiedAt,
  history,
}: {
  workshopId: string;
  verifiedBadge: boolean;
  verifiedAt: Date | null;
  history: VerificationHistoryRow[];
}) {
  return (
    <div className="space-y-4">
      {verifiedBadge ? (
        <RevokeForm workshopId={workshopId} verifiedAt={verifiedAt} />
      ) : (
        <GrantForm workshopId={workshopId} />
      )}
      <HistoryList history={history} />
    </div>
  );
}

function GrantForm({ workshopId }: { workshopId: string }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(grantVerification, undefined);

  return (
    <form action={formAction} className="space-y-3 rounded border border-neutral-200 bg-neutral-50 p-4">
      <input type="hidden" name="workshopId" value={workshopId} />
      <p className="text-sm text-neutral-700">Not currently verified.</p>
      <div>
        <label className="block text-xs text-neutral-500">What was checked (required)</label>
        <textarea
          name="checkedItemsNote"
          required
          rows={3}
          className="mt-1 w-full rounded border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900"
          placeholder="e.g. business registration seen, owner identity confirmed by call, premises photo reviewed…"
        />
      </div>
      <div>
        <label className="block text-xs text-neutral-500">
          Document note (optional — no upload flow here yet, see below)
        </label>
        <textarea
          name="documentNote"
          rows={2}
          className="mt-1 w-full rounded border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900"
          placeholder="Describe any document reviewed, e.g. filename/reference kept elsewhere"
        />
      </div>
      <div>
        <label className="block text-xs text-neutral-500">Note (optional)</label>
        <input
          name="reason"
          className="mt-1 w-full rounded border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900"
        />
      </div>
      <div>
        <label className="block text-xs text-neutral-500">Effective date</label>
        <input
          type="date"
          name="effectiveAt"
          defaultValue={todayInputValue()}
          className="mt-1 rounded border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900"
        />
      </div>
      <p className="rounded border border-neutral-200 bg-neutral-100 px-3 py-2 text-xs text-neutral-500">
        This is a text-only check note, not a document-upload flow — S3 storage exists
        (src/lib/storage.ts) but attaching real evidence files here wasn&rsquo;t built this pass.
      </p>
      <button
        type="submit"
        disabled={pending}
        className="rounded bg-emerald-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-600 disabled:opacity-60"
      >
        {pending ? "Granting…" : "Grant verification"}
      </button>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state?.ok && state.message && <p className="text-sm text-emerald-600">{state.message}</p>}
    </form>
  );
}

function RevokeForm({ workshopId, verifiedAt }: { workshopId: string; verifiedAt: Date | null }) {
  const [step, setStep] = useState<0 | 1>(0);
  const [state, formAction, pending] = useActionState<ActionState, FormData>(revokeVerification, undefined);

  return (
    <div className="space-y-3 rounded border border-emerald-200 bg-emerald-50 p-4">
      <p className="text-sm text-emerald-700">
        Verified{verifiedAt ? ` since ${formatDateTime(verifiedAt)}` : ""}.
      </p>
      {step === 0 ? (
        <button
          type="button"
          onClick={() => setStep(1)}
          className="rounded border border-red-200 px-3 py-1.5 text-sm text-red-700 hover:border-red-400"
        >
          Revoke verification
        </button>
      ) : (
        <form action={formAction} className="space-y-3 rounded border border-red-200 bg-red-50 p-4">
          <input type="hidden" name="workshopId" value={workshopId} />
          <div>
            <label className="block text-xs text-neutral-500">Reason (required)</label>
            <textarea
              name="reason"
              required
              rows={2}
              className="mt-1 w-full rounded border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900"
              placeholder="Why the verified mark is being revoked"
            />
          </div>
          <div>
            <label className="block text-xs text-neutral-500">Effective date</label>
            <input
              type="date"
              name="effectiveAt"
              defaultValue={todayInputValue()}
              className="mt-1 rounded border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900"
            />
          </div>
          <p className="text-xs text-neutral-500">The workshop owner will be notified.</p>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={pending}
              className="rounded bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-60"
            >
              {pending ? "Revoking…" : "Yes, revoke"}
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
      )}
    </div>
  );
}

function HistoryList({ history }: { history: VerificationHistoryRow[] }) {
  if (history.length === 0) {
    return (
      <div className="rounded border border-dashed border-neutral-200 p-6 text-center text-sm text-neutral-500">
        No verification history yet.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {history.map((entry) => (
        <div key={entry.id} className="rounded border border-neutral-200 px-3 py-2 text-sm">
          <div className="flex items-center justify-between">
            <span className={entry.action === "GRANTED" ? "text-emerald-600" : "text-red-600"}>
              {entry.action === "GRANTED" ? "Granted" : "Revoked"}
            </span>
            <span className="text-xs text-neutral-500">{formatDateTime(entry.effectiveAt)} effective</span>
          </div>
          {entry.reason && <p className="mt-1 text-neutral-700">{entry.reason}</p>}
          {entry.checkedItems != null && (
            <p className="mt-1 text-xs text-neutral-500">
              Checked: {JSON.stringify(entry.checkedItems)}
            </p>
          )}
          <p className="mt-1 text-xs text-neutral-500">
            By admin {entry.performedByAdminId} — recorded {formatDateTime(entry.createdAt)}
          </p>
        </div>
      ))}
    </div>
  );
}
