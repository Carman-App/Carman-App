"use client";

import { useActionState, useState } from "react";
import { decideAbuseReport, markReportInReview, type ActionState } from "../../actions";

export function InReviewButton({ reportId }: { reportId: string }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(markReportInReview, undefined);
  return (
    <form action={formAction}>
      <input type="hidden" name="reportId" value={reportId} />
      <button
        type="submit"
        disabled={pending}
        className="rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-800 hover:border-neutral-500 disabled:opacity-60"
      >
        {pending ? "Saving…" : "Mark in review"}
      </button>
      {state?.error && <p className="text-xs text-red-600">{state.error}</p>}
    </form>
  );
}

export function DecideForm({ reportId }: { reportId: string }) {
  const [decision, setDecision] = useState<"ACTIONED" | "DISMISSED">("DISMISSED");
  const [state, formAction, pending] = useActionState<ActionState, FormData>(decideAbuseReport, undefined);

  return (
    <form action={formAction} className="space-y-3 rounded border border-neutral-200 p-4">
      <input type="hidden" name="reportId" value={reportId} />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setDecision("ACTIONED")}
          className={`rounded border px-3 py-1.5 text-sm ${
            decision === "ACTIONED" ? "border-amber-400 bg-amber-100 text-amber-800" : "border-neutral-300 text-neutral-700"
          }`}
        >
          Actioned
        </button>
        <button
          type="button"
          onClick={() => setDecision("DISMISSED")}
          className={`rounded border px-3 py-1.5 text-sm ${
            decision === "DISMISSED" ? "border-neutral-500 bg-neutral-50 text-neutral-900" : "border-neutral-300 text-neutral-700"
          }`}
        >
          Dismissed
        </button>
      </div>
      <input type="hidden" name="decision" value={decision} />
      <div>
        <label className="block text-xs text-neutral-500">
          What action was taken? {decision === "ACTIONED" ? "(required)" : "(optional)"}
        </label>
        <textarea
          name="actionTaken"
          required={decision === "ACTIONED"}
          rows={2}
          className="mt-1 w-full rounded border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900"
          placeholder={decision === "ACTIONED" ? "e.g. account suspended for TOS violation" : "Why is this being dismissed?"}
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded bg-neutral-900 px-3 py-1.5 text-sm font-medium text-neutral-100 hover:bg-neutral-800 disabled:opacity-60"
      >
        {pending ? "Saving…" : `Confirm ${decision.toLowerCase()}`}
      </button>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
    </form>
  );
}
