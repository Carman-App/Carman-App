"use client";

import { useActionState } from "react";
import { requestDataExport, type ActionState } from "./actions";

export function ExportForm({ defaultAccountId }: { defaultAccountId?: string }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(requestDataExport, undefined);

  return (
    <form action={formAction} className="space-y-3 rounded border border-neutral-200 p-4">
      <div>
        <label className="block text-xs text-neutral-500">Account id</label>
        <input
          name="accountId"
          defaultValue={defaultAccountId}
          required
          placeholder="e.g. clx1a2b3c..."
          className="mt-1 w-full max-w-md rounded border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900"
        />
        <p className="mt-1 text-xs text-neutral-500">
          Paste the id from an account&rsquo;s /accounts/[id] URL.
        </p>
      </div>
      <div>
        <label className="block text-xs text-neutral-500">Reason (required)</label>
        <textarea
          name="reason"
          required
          rows={2}
          placeholder="e.g. subject access request via support ticket #123"
          className="mt-1 w-full max-w-md rounded border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded bg-neutral-900 px-3 py-1.5 text-sm font-medium text-neutral-100 hover:bg-neutral-800 disabled:opacity-60"
      >
        {pending ? "Generating…" : "Generate export"}
      </button>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state?.ok && (
        <p className="text-sm text-emerald-600">
          {state.message}{" "}
          {state.requestId && (
            <a href={`/privacy/export/${state.requestId}/download`} className="underline">
              Download now →
            </a>
          )}
        </p>
      )}
    </form>
  );
}
