"use client";

import { useActionState } from "react";
import { createDisclosureRequest, type ActionState } from "./actions";
import { DisclosureRequestType } from "@/generated/prisma/enums";
import { titleCase } from "@/lib/format";

const TYPES = Object.values(DisclosureRequestType) as DisclosureRequestType[];

export function NewDisclosureForm() {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(createDisclosureRequest, undefined);

  return (
    <form action={formAction} className="space-y-3 rounded border border-neutral-200 p-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-neutral-500">Requester name (required)</label>
          <input name="requesterName" required className="mt-1 w-full rounded border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900" />
        </div>
        <div>
          <label className="block text-xs text-neutral-500">Requester organization (required)</label>
          <input name="requesterOrg" required className="mt-1 w-full rounded border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-neutral-500">Request type (required)</label>
          <select name="requestType" required defaultValue="" className="mt-1 w-full rounded border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900">
            <option value="" disabled>
              Pick a type…
            </option>
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {titleCase(t)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-neutral-500">Received on (required)</label>
          <input type="date" name="receivedAt" required className="mt-1 w-full rounded border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900" />
        </div>
      </div>
      <div>
        <label className="block text-xs text-neutral-500">Legal authority (required)</label>
        <input
          name="legalAuthority"
          required
          placeholder="e.g. warrant/subpoena reference, statutory basis"
          className="mt-1 w-full rounded border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900"
        />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-xs text-neutral-500">Related account ID (optional)</label>
          <input name="relatedAccountId" className="mt-1 w-full rounded border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900" />
        </div>
        <div>
          <label className="block text-xs text-neutral-500">Related entity type (optional)</label>
          <input name="relatedEntityType" className="mt-1 w-full rounded border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900" />
        </div>
        <div>
          <label className="block text-xs text-neutral-500">Related entity ID (optional)</label>
          <input name="relatedEntityId" className="mt-1 w-full rounded border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900" />
        </div>
      </div>
      <div>
        <label className="block text-xs text-neutral-500">What was disclosed (required)</label>
        <textarea
          name="whatWasDisclosed"
          required
          rows={3}
          className="mt-1 w-full rounded border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900"
        />
      </div>
      <label className="flex items-center gap-2 text-sm text-neutral-700">
        <input type="checkbox" name="userNotified" className="rounded border-neutral-300 bg-white" />
        The user was notified of this disclosure
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded bg-neutral-900 px-3 py-1.5 text-sm font-medium text-neutral-100 hover:bg-neutral-800 disabled:opacity-60"
      >
        {pending ? "Recording…" : "Record disclosure"}
      </button>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
    </form>
  );
}
