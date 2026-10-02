"use client";

import { useActionState } from "react";
import { replyToTicket, logInboundMessage, type ActionState } from "../actions";

export function ReplyForm({ ticketId, channel }: { ticketId: string; channel: string }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(replyToTicket, undefined);

  return (
    <form action={formAction} className="space-y-2 rounded border border-neutral-200 p-3">
      <input type="hidden" name="ticketId" value={ticketId} />
      <label className="block text-xs text-neutral-500">
        Reply on {channel} {channel !== "IN_APP" && "(no live provider — recorded, not sent)"}
      </label>
      <textarea
        name="body"
        required
        rows={3}
        className="w-full rounded border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900"
        placeholder="Write the reply…"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-carma-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-carma-700 disabled:opacity-60"
      >
        {pending ? "Sending…" : "Send reply"}
      </button>
      {state?.error && <p className="text-xs text-red-600">{state.error}</p>}
      {state?.ok && <p className="text-xs text-emerald-600">{state.message}</p>}
    </form>
  );
}

export function LogInboundForm({ ticketId }: { ticketId: string }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(logInboundMessage, undefined);

  return (
    <form action={formAction} className="space-y-2 rounded border border-neutral-200 p-3">
      <input type="hidden" name="ticketId" value={ticketId} />
      <label className="block text-xs text-neutral-500">
        Log what came in (transcribe a call/email/SMS/WhatsApp message — there&rsquo;s no inbound
        webhook for any of those channels)
      </label>
      <textarea
        name="body"
        required
        rows={3}
        className="w-full rounded border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-800 hover:border-neutral-500 disabled:opacity-60"
      >
        {pending ? "Logging…" : "Log inbound message"}
      </button>
      {state?.error && <p className="text-xs text-red-600">{state.error}</p>}
      {state?.ok && <p className="text-xs text-emerald-600">{state.message}</p>}
    </form>
  );
}
