"use client";

import { useActionState, useState } from "react";
import { correctRegion, type ActionState } from "./actions";
import { Region } from "@/generated/prisma/enums";
import { REGION_LABELS, currencyForRegion } from "@/lib/region";

const REGIONS = Object.values(Region) as Region[];

export function RegionPanel({ accountId, currentRegion }: { accountId: string; currentRegion: Region }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<ActionState, FormData>(correctRegion, undefined);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-800 hover:border-neutral-500"
      >
        Correct country / currency
      </button>
    );
  }

  return (
    <form action={formAction} className="space-y-3 rounded border border-neutral-200 p-4">
      <input type="hidden" name="accountId" value={accountId} />
      <p className="text-xs text-neutral-500">
        This schema doesn&rsquo;t stamp a currency on individual records (FuelRecord/ServiceRecord/
        etc. store bare Decimal amounts, no currency column) — so changing the account&rsquo;s
        country only changes which currency new aggregates/displays assume going forward. It cannot
        convert or re-label historical record amounts, because they were never tagged with a
        currency to begin with. That&rsquo;s a data-model gap being flagged, not worked around.
      </p>
      <div>
        <label className="block text-xs text-neutral-500">New region (current: {REGION_LABELS[currentRegion]})</label>
        <select
          name="region"
          defaultValue=""
          required
          className="mt-1 w-full rounded border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900"
        >
          <option value="" disabled>
            Pick a region…
          </option>
          {REGIONS.map((r) => (
            <option key={r} value={r} disabled={r === currentRegion}>
              {REGION_LABELS[r]} ({currencyForRegion(r)})
            </option>
          ))}
        </select>
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
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-neutral-900 px-3 py-1.5 text-sm font-medium text-neutral-100 hover:bg-neutral-800 disabled:opacity-60"
        >
          {pending ? "Saving…" : "Apply region change"}
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
