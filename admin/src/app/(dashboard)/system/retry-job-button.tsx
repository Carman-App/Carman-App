"use client";

import { useActionState } from "react";
import { retryFailedJob, type ActionState } from "./actions";

export function RetryJobButton({ jobId }: { jobId: string }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(retryFailedJob, undefined);
  return (
    <div>
      <form action={formAction}>
        <input type="hidden" name="jobId" value={jobId} />
        <button
          type="submit"
          disabled={pending}
          className="rounded border border-neutral-300 px-2 py-1 text-xs text-neutral-700 hover:border-neutral-500 disabled:opacity-60"
        >
          {pending ? "Retrying…" : "Retry now"}
        </button>
      </form>
      {state?.error && <p className="mt-1 max-w-xs text-xs text-red-600">{state.error}</p>}
      {state?.ok && <p className="mt-1 max-w-xs text-xs text-emerald-600">{state.message}</p>}
    </div>
  );
}
