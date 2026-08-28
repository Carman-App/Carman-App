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
        className="rounded border border-red-800 px-3 py-1.5 text-sm text-red-300 hover:border-red-600"
      >
        Delete this account
      </button>
    );
  }

  return (
    <form action={formAction} className="space-y-3 rounded border border-red-900/50 bg-red-950/10 p-4">
      <input type="hidden" name="accountId" value={accountId} />
      <p className="text-sm text-neutral-200">
        This is an admin-initiated soft delete (there is no self-serve deletion in the mobile app
        today). It sets a deletion marker; the account is restorable for {GRACE_WINDOW_DAYS} days.
      </p>
      <div>
        <label className="block text-xs text-neutral-500">Reason (required)</label>
        <textarea
          name="reason"
          required
          rows={2}
          className="mt-1 w-full rounded border border-neutral-700 bg-neutral-950 px-2 py-1 text-sm text-neutral-100"
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
          className="rounded border border-neutral-700 px-3 py-1.5 text-sm text-neutral-400 hover:border-neutral-500"
        >
          Cancel
        </button>
      </div>
      {state?.error && <p className="text-sm text-red-400">{state.error}</p>}
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
        className="w-full rounded border border-neutral-700 bg-neutral-950 px-2 py-1 text-sm text-neutral-100"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded bg-neutral-100 px-3 py-1.5 text-sm font-medium text-neutral-900 hover:bg-white disabled:opacity-60"
      >
        {pending ? "Restoring…" : "Restore"}
      </button>
      {state?.error && <p className="text-sm text-red-400">{state.error}</p>}
    </form>
  );
}
