"use client";

import { useActionState } from "react";
import { createRestriction, type ActionState } from "./actions";
import { RestrictionCapability } from "@/generated/prisma/enums";
import { titleCase } from "@/lib/format";

const CAPABILITIES = Object.values(RestrictionCapability) as RestrictionCapability[];
const DURATION_PRESETS = [1, 3, 7, 14, 30];

export function CreateRestrictionForm() {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(createRestriction, undefined);

  return (
    <form action={formAction} className="space-y-3 rounded border border-neutral-200 p-4">
      <div>
        <label className="block text-xs text-neutral-500">Account ID (required)</label>
        <input
          name="accountId"
          required
          className="mt-1 w-full rounded border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900"
        />
      </div>
      <div>
        <label className="block text-xs text-neutral-500">Capability to restrict (required)</label>
        <select
          name="capability"
          required
          defaultValue=""
          className="mt-1 w-full rounded border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900"
        >
          <option value="" disabled>
            Pick a capability…
          </option>
          {CAPABILITIES.map((c) => (
            <option key={c} value={c}>
              {titleCase(c)}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs text-neutral-500">Duration, in days (required)</label>
        <select
          name="durationDays"
          required
          defaultValue="7"
          className="mt-1 w-full rounded border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900"
        >
          {DURATION_PRESETS.map((d) => (
            <option key={d} value={d}>
              {d} day{d === 1 ? "" : "s"}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-neutral-500">
          Expires automatically — no separate job runs; every read computes active as endAt in the
          future and not lifted early.
        </p>
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
      <button
        type="submit"
        disabled={pending}
        className="rounded bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-60"
      >
        {pending ? "Restricting…" : "Apply restriction"}
      </button>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state?.ok && <p className="text-sm text-emerald-600">{state.message}</p>}
    </form>
  );
}
