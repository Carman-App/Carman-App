"use client";

import { useActionState, useState } from "react";
import { stageFlagDraft, type ActionState } from "../actions";
import { Region } from "@/generated/prisma/enums";
import { REGION_LABELS } from "@/lib/region";

const REGIONS = Object.values(Region) as Region[];

export type FlagFormValues = {
  key: string;
  description: string;
  isEnabled: boolean;
  audience: { accountIds?: string[]; countries?: string[]; cohort?: string } | null;
};

export function FlagForm({ initial }: { initial: FlagFormValues }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(stageFlagDraft, undefined);
  const initialTargeting = initial.audience?.accountIds
    ? "accountIds"
    : initial.audience?.countries
      ? "countries"
      : initial.audience?.cohort
        ? "cohort"
        : "everyone";
  const [targeting, setTargeting] = useState(initialTargeting);

  return (
    <form action={formAction} className="space-y-3 rounded border border-neutral-200 p-4">
      <input type="hidden" name="key" value={initial.key} />
      <div>
        <label className="block text-xs text-neutral-500">Description</label>
        <textarea
          name="description"
          rows={2}
          defaultValue={initial.description}
          className="mt-1 w-full rounded border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900"
        />
      </div>

      <label className="flex items-center gap-2 text-sm text-neutral-700">
        <input type="checkbox" name="isEnabled" defaultChecked={initial.isEnabled} className="rounded border-neutral-300" />
        Enabled
      </label>

      <div>
        <label className="block text-xs text-neutral-500">Audience</label>
        <select
          value={targeting}
          onChange={(e) => setTargeting(e.target.value)}
          name="targeting"
          className="mt-1 w-full rounded border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900"
        >
          <option value="everyone">Everyone (when enabled)</option>
          <option value="accountIds">Specific account ids</option>
          <option value="countries">Specific regions</option>
          <option value="cohort">Named cohort</option>
        </select>
      </div>

      {targeting === "accountIds" && (
        <div>
          <label className="block text-xs text-neutral-500">Account ids (comma or newline separated)</label>
          <textarea
            name="accountIds"
            rows={3}
            defaultValue={(initial.audience?.accountIds ?? []).join("\n")}
            className="mt-1 w-full rounded border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900"
          />
        </div>
      )}

      {targeting === "countries" && (
        <div>
          <label className="block text-xs text-neutral-500">Regions</label>
          <div className="mt-1 flex flex-wrap gap-3 text-sm text-neutral-700">
            {REGIONS.map((r) => (
              <label key={r} className="flex items-center gap-1">
                <input
                  type="checkbox"
                  name="countries"
                  value={r}
                  defaultChecked={initial.audience?.countries?.includes(r)}
                  className="rounded border-neutral-300"
                />
                {REGION_LABELS[r]}
              </label>
            ))}
          </div>
        </div>
      )}

      {targeting === "cohort" && (
        <div>
          <label className="block text-xs text-neutral-500">Cohort name</label>
          <input
            name="cohort"
            defaultValue={initial.audience?.cohort ?? ""}
            placeholder="e.g. power_users (no cohort evaluator exists yet — see banner above)"
            className="mt-1 w-full rounded border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900"
          />
        </div>
      )}

      <div>
        <label className="block text-xs text-neutral-500">Note (optional context for this draft)</label>
        <textarea
          name="note"
          rows={2}
          className="mt-1 w-full rounded border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900"
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-carma-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-carma-700 disabled:opacity-60"
      >
        {pending ? "Staging…" : "Stage draft"}
      </button>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state?.ok && <p className="text-sm text-emerald-600">{state.message}</p>}
    </form>
  );
}
