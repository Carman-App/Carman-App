"use client";

import { useActionState, useState } from "react";
import { addSuppression, type ActionState } from "./actions";
import { CampaignChannel, MessageClass } from "@/generated/prisma/enums";
import { titleCase } from "@/lib/format";

const CHANNELS = Object.values(CampaignChannel) as CampaignChannel[];
const CLASSES = Object.values(MessageClass) as MessageClass[];

/**
 * COMM-03 admin-facing "add suppression" form — reused from the account
 * detail page's Messaging history section. Always writes reason ADMIN_SET;
 * there's no real end-user opt-out flow in this codebase to produce
 * USER_OPTED_OUT/BOUNCED rows yet.
 */
export function SuppressionForm({ accountId }: { accountId: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<ActionState, FormData>(addSuppression, undefined);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-800 hover:border-neutral-500"
      >
        Add suppression
      </button>
    );
  }

  return (
    <form action={formAction} className="space-y-3 rounded border border-neutral-200 p-4">
      <input type="hidden" name="accountId" value={accountId} />
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-neutral-500">Channel</label>
          <select
            name="channel"
            defaultValue=""
            className="mt-1 w-full rounded border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900"
          >
            <option value="">All channels</option>
            {CHANNELS.map((c) => (
              <option key={c} value={c}>
                {titleCase(c)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-neutral-500">Message class</label>
          <select
            name="messageClass"
            defaultValue=""
            className="mt-1 w-full rounded border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900"
          >
            <option value="">All classes</option>
            {CLASSES.map((c) => (
              <option key={c} value={c}>
                {titleCase(c)}
              </option>
            ))}
          </select>
        </div>
      </div>
      <p className="text-xs text-neutral-500">
        Reason is always recorded as Admin set — no real end-user opt-out flow exists yet to produce a
        User opted out / Bounced row.
      </p>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-carma-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-carma-700 disabled:opacity-60"
        >
          {pending ? "Saving…" : "Add suppression"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-600 hover:border-neutral-500"
        >
          Cancel
        </button>
      </div>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state?.ok && <p className="text-sm text-emerald-600">{state.message}</p>}
    </form>
  );
}
