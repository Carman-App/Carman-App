"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { logAbuseReport, type ActionState } from "../../actions";

export function NewReportForm() {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(logAbuseReport, undefined);
  const router = useRouter();

  useEffect(() => {
    if (state?.ok) router.push("/trust");
  }, [state?.ok, router]);

  return (
    <form action={formAction} className="space-y-3 rounded border border-neutral-200 p-4">
      <div>
        <label className="block text-xs text-neutral-500">Reported account ID (required)</label>
        <input
          name="reportedAccountId"
          required
          className="mt-1 w-full rounded border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900"
        />
      </div>
      <div>
        <label className="block text-xs text-neutral-500">Reporter account ID (optional — leave blank if anonymous/external)</label>
        <input
          name="reporterAccountId"
          className="mt-1 w-full rounded border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-neutral-500">Reported entity type (optional)</label>
          <input
            name="reportedEntityType"
            placeholder="e.g. Vehicle, Job, Account"
            className="mt-1 w-full rounded border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900"
          />
        </div>
        <div>
          <label className="block text-xs text-neutral-500">Reported entity ID (optional)</label>
          <input
            name="reportedEntityId"
            className="mt-1 w-full rounded border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900"
          />
        </div>
      </div>
      <div>
        <label className="block text-xs text-neutral-500">Reason (required)</label>
        <input
          name="reason"
          required
          className="mt-1 w-full rounded border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900"
        />
      </div>
      <div>
        <label className="block text-xs text-neutral-500">Description (optional)</label>
        <textarea
          name="description"
          rows={3}
          className="mt-1 w-full rounded border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded bg-neutral-900 px-3 py-1.5 text-sm font-medium text-neutral-100 hover:bg-neutral-800 disabled:opacity-60"
      >
        {pending ? "Logging…" : "Log report"}
      </button>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
    </form>
  );
}
