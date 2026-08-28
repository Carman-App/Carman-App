"use client";

import { useActionState } from "react";
import { requestConsentSession, type ActionState } from "./actions";

export function RequestConsentForm() {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(requestConsentSession, undefined);

  return (
    <form action={formAction} className="space-y-3 rounded border border-neutral-200 p-4">
      <div>
        <label className="block text-xs text-neutral-500">Account ID (required)</label>
        <input
          name="accountId"
          required
          placeholder="Paste the account id from the Accounts search"
          className="mt-1 w-full rounded border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900"
        />
      </div>
      <div>
        <label className="block text-xs text-neutral-500">Consent method</label>
        <select disabled className="mt-1 w-full rounded border border-neutral-200 bg-neutral-50 px-2 py-1 text-sm text-neutral-500">
          <option>Asserted (obtained some other way, e.g. a phone call)</option>
        </select>
        <p className="mt-1 text-xs text-neutral-500">
          Mobile push request is reserved for a future real handshake — there is no mobile-side
          consent flow to trigger today, so every session here is asserted.
        </p>
      </div>
      <div>
        <label className="block text-xs text-neutral-500">Notes / reason (required)</label>
        <textarea
          name="notes"
          required
          rows={2}
          className="mt-1 w-full rounded border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900"
          placeholder="Why is this session being requested?"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded bg-neutral-900 px-3 py-1.5 text-sm font-medium text-neutral-100 hover:bg-neutral-800 disabled:opacity-60"
      >
        {pending ? "Requesting…" : "Request session"}
      </button>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state?.ok && <p className="text-sm text-emerald-600">{state.message}</p>}
    </form>
  );
}
