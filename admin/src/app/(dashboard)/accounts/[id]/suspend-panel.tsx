"use client";

import { useActionState, useState } from "react";
import { suspendAccount, unsuspendAccount, type ActionState } from "./actions";
import { SuspensionReason } from "@/generated/prisma/enums";
import { titleCase, formatDateTime } from "@/lib/format";

const REASONS = Object.values(SuspensionReason) as SuspensionReason[];

export function SuspendPanel({
  accountId,
  suspension,
}: {
  accountId: string;
  suspension: {
    suspendedAt: Date;
    suspendedReason: SuspensionReason;
    suspendedNote: string | null;
    suspendedByAdminId: string | null;
  } | null;
}) {
  if (suspension) {
    return <UnsuspendForm accountId={accountId} suspension={suspension} />;
  }
  return <SuspendForm accountId={accountId} />;
}

function SuspendForm({ accountId }: { accountId: string }) {
  const [step, setStep] = useState<0 | 1>(0);
  const [state, formAction, pending] = useActionState<ActionState, FormData>(suspendAccount, undefined);

  if (step === 0) {
    return (
      <button
        type="button"
        onClick={() => setStep(1)}
        className="rounded border border-red-800 px-3 py-1.5 text-sm text-red-300 hover:border-red-600"
      >
        Suspend this account
      </button>
    );
  }

  return (
    <form action={formAction} className="space-y-3 rounded border border-red-900/50 bg-red-950/10 p-4">
      <input type="hidden" name="accountId" value={accountId} />
      <div>
        <label className="block text-xs text-neutral-500">Reason (required)</label>
        <select
          name="suspendReason"
          required
          defaultValue=""
          className="mt-1 w-full rounded border border-neutral-700 bg-neutral-950 px-2 py-1 text-sm text-neutral-100"
        >
          <option value="" disabled>
            Pick a reason…
          </option>
          {REASONS.map((r) => (
            <option key={r} value={r}>
              {titleCase(r)}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs text-neutral-500">Note (required)</label>
        <textarea
          name="note"
          required
          rows={2}
          className="mt-1 w-full rounded border border-neutral-700 bg-neutral-950 px-2 py-1 text-sm text-neutral-100"
          placeholder="Details for the record"
        />
      </div>
      <p className="rounded border border-neutral-800 bg-neutral-900/60 px-3 py-2 text-xs text-neutral-400">
        They keep their data. They lose: signing in to the app, creating new records, and receiving
        notifications. They keep: existing garages/vehicles/history, which stay visible read-only.
        (Actual sign-in enforcement belongs wherever end-user auth eventually lands — no login system
        exists yet to block today.)
      </p>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-60"
        >
          {pending ? "Suspending…" : "Yes, suspend"}
        </button>
        <button
          type="button"
          onClick={() => setStep(0)}
          className="rounded border border-neutral-700 px-3 py-1.5 text-sm text-neutral-400 hover:border-neutral-500"
        >
          Cancel
        </button>
      </div>
      {state?.error && <p className="text-sm text-red-400">{state.error}</p>}
    </form>
  );
}

function UnsuspendForm({
  accountId,
  suspension,
}: {
  accountId: string;
  suspension: {
    suspendedAt: Date;
    suspendedReason: SuspensionReason;
    suspendedNote: string | null;
    suspendedByAdminId: string | null;
  };
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(unsuspendAccount, undefined);

  return (
    <div className="space-y-3 rounded border border-amber-900/50 bg-amber-950/10 p-4">
      <p className="text-sm text-amber-200">
        Suspended {formatDateTime(suspension.suspendedAt)} — {titleCase(suspension.suspendedReason)}
        {suspension.suspendedNote ? `: ${suspension.suspendedNote}` : ""}
      </p>
      <form action={formAction} className="space-y-2">
        <input type="hidden" name="accountId" value={accountId} />
        <label className="block text-xs text-neutral-500">Reason for unsuspending (required)</label>
        <textarea
          name="reason"
          required
          rows={2}
          className="w-full rounded border border-neutral-700 bg-neutral-950 px-2 py-1 text-sm text-neutral-100"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-neutral-100 px-3 py-1.5 text-sm font-medium text-neutral-900 hover:bg-white disabled:opacity-60"
        >
          {pending ? "Unsuspending…" : "Unsuspend"}
        </button>
        {state?.error && <p className="text-sm text-red-400">{state.error}</p>}
      </form>
    </div>
  );
}
