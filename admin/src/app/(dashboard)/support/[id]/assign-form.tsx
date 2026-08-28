"use client";

import { useActionState } from "react";
import { assignTicket, type ActionState } from "../actions";

export function AssignForm({
  ticketId,
  currentAssigneeId,
  admins,
}: {
  ticketId: string;
  currentAssigneeId: string | null;
  admins: { id: string; name: string }[];
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(assignTicket, undefined);

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="ticketId" value={ticketId} />
      <select
        name="assignedAdminId"
        defaultValue={currentAssigneeId ?? ""}
        className="rounded border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900"
      >
        <option value="">Unassigned</option>
        {admins.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
          </option>
        ))}
      </select>
      <button
        type="submit"
        disabled={pending}
        className="rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-800 hover:border-neutral-500 disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save"}
      </button>
      {state?.error && <p className="text-xs text-red-600">{state.error}</p>}
    </form>
  );
}
