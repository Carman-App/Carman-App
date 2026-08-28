"use client";

import { useActionState, useState } from "react";
import { grantExtension, type ActionState } from "../free-period-actions";

export type GrantableSubscription = { id: string; label: string; status: string };

export function GrantPanel({ options }: { options: GrantableSubscription[] }) {
  const [kind, setKind] = useState<"TRIAL_EXTENSION" | "FREE_PERIOD">("TRIAL_EXTENSION");
  const [state, formAction, pending] = useActionState<ActionState, FormData>(grantExtension, undefined);

  if (options.length === 0) {
    return <p className="text-sm text-neutral-500">No subscription exists to extend.</p>;
  }

  return (
    <form action={formAction} className="space-y-3 rounded border border-neutral-200 p-4">
      <div className="flex gap-4">
        <label className="flex items-center gap-2 text-sm text-neutral-700">
          <input
            type="radio"
            name="kind"
            value="TRIAL_EXTENSION"
            checked={kind === "TRIAL_EXTENSION"}
            onChange={() => setKind("TRIAL_EXTENSION")}
          />
          Extend trial (TRIALING only)
        </label>
        <label className="flex items-center gap-2 text-sm text-neutral-700">
          <input
            type="radio"
            name="kind"
            value="FREE_PERIOD"
            checked={kind === "FREE_PERIOD"}
            onChange={() => setKind("FREE_PERIOD")}
          />
          Grant a free period (sets ACTIVE, clears any grace)
        </label>
      </div>

      <div>
        <label className="block text-xs text-neutral-500">Subscription (required)</label>
        <select
          name="subscriptionId"
          required
          defaultValue=""
          className="mt-1 w-full rounded border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900"
        >
          <option value="" disabled>
            Pick a subscription…
          </option>
          {options
            .filter((o) => kind !== "TRIAL_EXTENSION" || o.status === "TRIALING")
            .map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
        </select>
      </div>

      <div>
        <label className="block text-xs text-neutral-500">End date (required)</label>
        <input
          type="date"
          name="endDate"
          required
          className="mt-1 rounded border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900"
        />
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

      <p className="rounded border border-neutral-200 bg-neutral-100 px-3 py-2 text-xs text-neutral-600">
        This writes a real end date onto the subscription and is visible on the account&rsquo;s
        billing history. No background job in this codebase automatically changes status when that
        date passes — it&rsquo;s the real source of truth for support/billing conversations, not an
        automatically-enforced cutoff.
      </p>

      <button
        type="submit"
        disabled={pending}
        className="rounded bg-neutral-900 px-3 py-1.5 text-sm font-medium text-neutral-100 hover:bg-neutral-800 disabled:opacity-60"
      >
        {pending ? "Saving…" : "Grant"}
      </button>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state?.message && <p className="text-sm text-emerald-600">{state.message}</p>}
    </form>
  );
}
