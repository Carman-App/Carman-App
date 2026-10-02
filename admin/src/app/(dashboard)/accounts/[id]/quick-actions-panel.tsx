"use client";

import { useActionState, useState } from "react";
import {
  resendVerificationCode,
  resetSignIn,
  unlockAccount,
  manualVerifyEmail,
  type ActionState,
} from "./actions";

function QuickActionButton({
  accountId,
  action,
  label,
}: {
  accountId: string;
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  label: string;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(action, undefined);
  return (
    <form action={formAction} className="flex flex-col items-start gap-1">
      <input type="hidden" name="accountId" value={accountId} />
      <button
        type="submit"
        disabled={pending}
        className="rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-800 hover:border-neutral-500 disabled:opacity-60"
      >
        {pending ? "Working…" : label}
      </button>
      {state?.message && <p className="text-xs text-neutral-500">{state.message}</p>}
      {state?.error && <p className="text-xs text-red-600">{state.error}</p>}
    </form>
  );
}

function ManualVerifyForm({ accountId, alreadyVerified }: { accountId: string; alreadyVerified: boolean }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<ActionState, FormData>(manualVerifyEmail, undefined);

  if (alreadyVerified) {
    return <p className="text-xs text-neutral-500">Email already verified.</p>;
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-800 hover:border-neutral-500"
      >
        Manually verify email
      </button>
    );
  }

  return (
    <form action={formAction} className="space-y-2 rounded border border-neutral-200 p-3">
      <input type="hidden" name="accountId" value={accountId} />
      <label className="block text-xs text-neutral-500">Reason (required)</label>
      <textarea
        name="reason"
        required
        rows={2}
        className="w-full rounded border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900"
        placeholder="Why are you verifying this manually?"
      />
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-carma-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-carma-700 disabled:opacity-60"
        >
          {pending ? "Saving…" : "Confirm verification"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-600 hover:border-neutral-500"
        >
          Cancel
        </button>
      </div>
      {state?.error && <p className="text-xs text-red-600">{state.error}</p>}
      {state?.ok && <p className="text-xs text-emerald-600">{state.message}</p>}
    </form>
  );
}

export function QuickActionsPanel({
  accountId,
  emailVerified,
}: {
  accountId: string;
  emailVerified: boolean;
}) {
  return (
    <div className="space-y-3 rounded border border-neutral-200 p-4">
      <div>
        <h3 className="text-sm font-medium text-neutral-800">Support quick-actions</h3>
        <p className="text-xs text-neutral-500">
          Resend / reset / unlock have no live channel to act on yet (no OTP, session-lock, or
          account-lock system exists) — they record the operator&rsquo;s intent to the audit log
          rather than faking a send. Manual verification is real.
        </p>
      </div>
      <div className="flex flex-wrap gap-3">
        <QuickActionButton accountId={accountId} action={resendVerificationCode} label="Resend verification code" />
        <QuickActionButton accountId={accountId} action={resetSignIn} label="Reset sign-in" />
        <QuickActionButton accountId={accountId} action={unlockAccount} label="Unlock" />
      </div>
      <ManualVerifyForm accountId={accountId} alreadyVerified={emailVerified} />
    </div>
  );
}
