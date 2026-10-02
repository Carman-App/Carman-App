"use client";

import { useActionState, useState } from "react";
import { closeTicket, reopenTicket, type ActionState } from "../actions";
import { TicketCategory } from "@/generated/prisma/enums";
import { titleCase } from "@/lib/format";

const CATEGORIES = Object.values(TicketCategory) as TicketCategory[];

export function CloseTicketForm({ ticketId }: { ticketId: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<ActionState, FormData>(closeTicket, undefined);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-800 hover:border-neutral-500"
      >
        Close ticket
      </button>
    );
  }

  return (
    <form action={formAction} className="space-y-3 rounded border border-neutral-200 p-4">
      <input type="hidden" name="ticketId" value={ticketId} />
      <div>
        <label className="block text-xs text-neutral-500">Category (required)</label>
        <select
          name="category"
          required
          defaultValue=""
          className="mt-1 w-full rounded border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900"
        >
          <option value="" disabled>
            Pick a category…
          </option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {titleCase(c)}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs text-neutral-500">Resolution note (required)</label>
        <textarea
          name="resolutionNote"
          required
          rows={2}
          className="mt-1 w-full rounded border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900"
        />
      </div>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-carma-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-carma-700 disabled:opacity-60"
        >
          {pending ? "Closing…" : "Confirm close"}
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
    </form>
  );
}

export function ReopenTicketForm({ ticketId }: { ticketId: string }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(reopenTicket, undefined);

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="ticketId" value={ticketId} />
      <label className="block text-xs text-neutral-500">Reason for reopening (required)</label>
      <textarea
        name="reason"
        required
        rows={2}
        className="w-full rounded border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-800 hover:border-neutral-500 disabled:opacity-60"
      >
        {pending ? "Reopening…" : "Reopen"}
      </button>
      {state?.error && <p className="text-xs text-red-600">{state.error}</p>}
    </form>
  );
}
