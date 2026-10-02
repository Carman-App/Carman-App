"use client";

import { useActionState, useState } from "react";
import { deleteAccount, restoreAccount, type ActionState } from "./actions";

const GRACE_WINDOW_DAYS = 30;

export function DeletePanel({ accountId }: { accountId: string }) {
  const [step, setStep] = useState<0 | 1>(0);
  const [state, formAction, pending] = useActionState<ActionState, FormData>(deleteAccount, undefined);

  if (step === 0) {
    return (
      <button
        type="button"
        onClick={() => setStep(1)}
        className="rounded border border-red-200 px-3 py-1.5 text-sm text-red-700 hover:border-red-400"
      >
        Delete this account
      </button>
    );
  }

  return (
    <form action={formAction} className="space-y-3 rounded border border-red-200 bg-red-50 p-4">
      <input type="hidden" name="accountId" value={accountId} />
      <p className="text-sm text-neutral-800">
        This is an admin-initiated soft delete (there is no self-serve deletion in the mobile app
        today). It sets a deletion marker; the account is restorable for {GRACE_WINDOW_DAYS} days.
      </p>

      <div className="rounded border border-neutral-200 bg-neutral-50 p-3 text-xs text-neutral-600">
        <p className="font-medium text-neutral-700">
          Data retention policy (PRIV-02) — the intended target, not what happens today
        </p>
        <p className="mt-1">
          Once retention execution exists, deleting an account is intended to: remove personal
          data/content (profile, garages/vehicles, records, documents, notifications), while keeping
          financial records required for tax/accounting retention (invoices, payments) in a
          minimised form for the regulatory retention period.
        </p>
        <p className="mt-2 text-amber-600">
          What actually happens today: clicking &ldquo;Yes, delete&rdquo; below only stamps{" "}
          <code>deletedAt</code>/<code>deletedByAdminId</code> on this Account row. Nothing is
          scrubbed, anonymized, or physically removed — not now, and not automatically after the
          {" "}{GRACE_WINDOW_DAYS}-day window either, since no purge job exists (see the Privacy
          section&rsquo;s Retention page for the same job-queue prerequisite). Past the window the
          console simply stops offering restore; the underlying rows are untouched.
        </p>
      </div>

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
          {pending ? "Deleting…" : "Yes, delete"}
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

export function RestorePanel({ accountId }: { accountId: string }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(restoreAccount, undefined);

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="accountId" value={accountId} />
      <label className="block text-xs text-neutral-500">Reason for restoring (required)</label>
      <textarea
        name="reason"
        required
        rows={2}
        className="w-full rounded border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-carma-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-carma-700 disabled:opacity-60"
      >
        {pending ? "Restoring…" : "Restore"}
      </button>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
    </form>
  );
}
