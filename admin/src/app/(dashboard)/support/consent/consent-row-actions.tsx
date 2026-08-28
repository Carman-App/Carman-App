"use client";

import { useActionState, useState } from "react";
import { grantConsentSession, denyConsentSession, endConsentSession, type ActionState } from "./actions";

export function GrantForm({ sessionId }: { sessionId: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<ActionState, FormData>(grantConsentSession, undefined);

  if (!open) {
    return (
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded border border-emerald-200 px-2 py-1 text-xs text-emerald-700 hover:border-emerald-400"
        >
          Mark granted
        </button>
        <DenyInline sessionId={sessionId} />
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-2 rounded border border-neutral-200 p-2">
      <input type="hidden" name="sessionId" value={sessionId} />
      <label className="block text-xs text-neutral-500">How was consent actually obtained?</label>
      <textarea
        name="grantNote"
        required
        rows={2}
        className="w-full rounded border border-neutral-300 bg-white px-2 py-1 text-xs text-neutral-900"
        placeholder="e.g. confirmed verbally on a phone call at 14:02"
      />
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-emerald-700 px-2 py-1 text-xs font-medium text-white hover:bg-emerald-600 disabled:opacity-60"
        >
          {pending ? "Saving…" : "Confirm granted"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded border border-neutral-300 px-2 py-1 text-xs text-neutral-600"
        >
          Cancel
        </button>
      </div>
      {state?.error && <p className="text-xs text-red-600">{state.error}</p>}
    </form>
  );
}

function DenyInline({ sessionId }: { sessionId: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<ActionState, FormData>(denyConsentSession, undefined);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded border border-red-200 px-2 py-1 text-xs text-red-700 hover:border-red-300"
      >
        Deny
      </button>
    );
  }

  return (
    <form action={formAction} className="space-y-2 rounded border border-neutral-200 p-2">
      <input type="hidden" name="sessionId" value={sessionId} />
      <textarea
        name="reason"
        required
        rows={2}
        className="w-full rounded border border-neutral-300 bg-white px-2 py-1 text-xs text-neutral-900"
        placeholder="Why was consent denied/not obtained?"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded bg-red-700 px-2 py-1 text-xs font-medium text-white hover:bg-red-600 disabled:opacity-60"
      >
        {pending ? "Saving…" : "Confirm denial"}
      </button>
      {state?.error && <p className="text-xs text-red-600">{state.error}</p>}
    </form>
  );
}

export function EndSessionForm({ sessionId }: { sessionId: string }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(endConsentSession, undefined);
  return (
    <form action={formAction}>
      <input type="hidden" name="sessionId" value={sessionId} />
      <button
        type="submit"
        disabled={pending}
        className="rounded border border-neutral-300 px-2 py-1 text-xs text-neutral-800 hover:border-neutral-500 disabled:opacity-60"
      >
        {pending ? "Ending…" : "End session now"}
      </button>
      {state?.error && <p className="text-xs text-red-600">{state.error}</p>}
    </form>
  );
}
