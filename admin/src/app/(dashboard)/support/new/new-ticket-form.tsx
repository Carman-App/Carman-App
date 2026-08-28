"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { createTicket, type ActionState } from "../actions";
import { TicketChannel } from "@/generated/prisma/enums";
import { titleCase } from "@/lib/format";

const CHANNELS = Object.values(TicketChannel) as TicketChannel[];

export function NewTicketForm() {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(createTicket, undefined);
  const router = useRouter();

  useEffect(() => {
    if (state?.ok) router.push("/support");
  }, [state?.ok, router]);

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
        <label className="block text-xs text-neutral-500">Channel (required)</label>
        <select
          name="channel"
          required
          defaultValue=""
          className="mt-1 w-full rounded border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900"
        >
          <option value="" disabled>
            Pick a channel…
          </option>
          {CHANNELS.map((c) => (
            <option key={c} value={c}>
              {titleCase(c)}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs text-neutral-500">Subject (required)</label>
        <input
          name="subject"
          required
          className="mt-1 w-full rounded border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900"
        />
      </div>
      <div>
        <label className="block text-xs text-neutral-500">What they said (optional)</label>
        <textarea
          name="initialMessage"
          rows={3}
          className="mt-1 w-full rounded border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900"
          placeholder="Transcribe the inbound message, if there is one"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded bg-neutral-900 px-3 py-1.5 text-sm font-medium text-neutral-100 hover:bg-neutral-800 disabled:opacity-60"
      >
        {pending ? "Opening…" : "Open ticket"}
      </button>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
    </form>
  );
}
