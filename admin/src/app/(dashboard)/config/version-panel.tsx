"use client";

import { useActionState, useState } from "react";
import { publishDraftAction, revertToVersionAction, discardDraftAction, type ActionState } from "./version-actions";
import { formatDateTime } from "@/lib/format";

function fmtVal(v: unknown): string {
  if (v === undefined) return "—";
  if (v === null) return "null";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

export type HistoryRow = {
  id: string;
  status: string;
  note: string | null;
  createdAt: Date;
  publishedAt: Date | null;
  publishedByAdminId: string | null;
  accountsTouchedCount: number | null;
};

/**
 * CFG-06/07 UI: shows the pending draft's diff against the live baseline
 * with a Publish button, and the full version history with per-row Revert.
 * Shared by every story that uses src/lib/config/versioning.ts (Country,
 * FeatureFlag, SubscriptionRules) instead of bespoke UI per object type.
 */
export function VersionPanel({
  objectKey,
  canPublish,
  draft,
  diff,
  history,
  revalidate,
}: {
  objectKey: string;
  canPublish: boolean;
  draft: { id: string; note: string | null } | null;
  diff: {
    baselineSource: "published_version" | "live_table" | "none";
    diffs: { field: string; before: unknown; after: unknown }[];
  } | null;
  history: HistoryRow[];
  revalidate: string;
}) {
  const [publishState, publishAction, publishPending] = useActionState<ActionState, FormData>(
    publishDraftAction,
    undefined,
  );
  const [discardState, discardAction, discardPending] = useActionState<ActionState, FormData>(
    discardDraftAction,
    undefined,
  );

  return (
    <div className="space-y-4">
      {draft ? (
        <div className="space-y-3 rounded border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm text-amber-800">
            There is an unpublished draft for <strong>{objectKey}</strong>
            {diff?.baselineSource === "none" ? " — nothing is live yet, publishing will create it." : "."}
          </p>

          {diff && diff.diffs.length > 0 ? (
            <div className="overflow-x-auto rounded border border-neutral-200">
              <table className="w-full min-w-max text-left text-sm">
                <thead className="bg-neutral-50 text-neutral-600">
                  <tr>
                    <th className="px-3 py-1.5 font-medium">Field</th>
                    <th className="px-3 py-1.5 font-medium">
                      {diff.baselineSource === "published_version" ? "Last published" : "Currently live"}
                    </th>
                    <th className="px-3 py-1.5 font-medium">Draft</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200">
                  {diff.diffs.map((d) => (
                    <tr key={d.field}>
                      <td className="whitespace-nowrap px-3 py-1.5 text-neutral-600">{d.field}</td>
                      <td className="px-3 py-1.5 text-red-700">{fmtVal(d.before)}</td>
                      <td className="px-3 py-1.5 text-emerald-700">{fmtVal(d.after)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-neutral-500">No field differences from the baseline.</p>
          )}

          {canPublish ? (
            <form action={publishAction} className="space-y-2">
              <input type="hidden" name="versionId" value={draft.id} />
              <input type="hidden" name="revalidate" value={revalidate} />
              <label className="block text-xs text-neutral-500">Reason (required to publish)</label>
              <textarea
                name="note"
                required
                defaultValue={draft.note ?? ""}
                rows={2}
                className="w-full rounded border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900"
              />
              <button
                type="submit"
                disabled={publishPending}
                className="rounded bg-emerald-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-600 disabled:opacity-60"
              >
                {publishPending ? "Publishing…" : "Publish draft"}
              </button>
              {publishState?.error && <p className="text-sm text-red-600">{publishState.error}</p>}
              {publishState?.ok && <p className="text-sm text-emerald-600">{publishState.message}</p>}
            </form>
          ) : (
            <p className="text-xs text-neutral-500">
              Publishing is OWNER-only. This draft is staged and ready — ask an Owner to review and publish it.
            </p>
          )}

          <form action={discardAction}>
            <input type="hidden" name="versionId" value={draft.id} />
            <input type="hidden" name="revalidate" value={revalidate} />
            <button
              type="submit"
              disabled={discardPending}
              className="rounded border border-neutral-300 px-2 py-1 text-xs text-neutral-600 hover:border-neutral-500"
            >
              {discardPending ? "Discarding…" : "Discard draft"}
            </button>
            {discardState?.error && <p className="text-xs text-red-600">{discardState.error}</p>}
          </form>
        </div>
      ) : (
        <p className="text-sm text-neutral-500">No pending draft for {objectKey}.</p>
      )}

      <div>
        <h3 className="mb-2 text-sm font-medium text-neutral-600">Version history</h3>
        {history.length === 0 ? (
          <p className="text-sm text-neutral-500">No versions yet.</p>
        ) : (
          <ul className="space-y-2">
            {history.map((v, idx) => (
              <li key={v.id} className="rounded border border-neutral-200 p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-neutral-700">
                    <strong>{v.status}</strong>{" "}
                    {v.status === "PUBLISHED" ? formatDateTime(v.publishedAt) : formatDateTime(v.createdAt)}
                    {v.accountsTouchedCount != null &&
                      ` · ${v.accountsTouchedCount} account${v.accountsTouchedCount === 1 ? "" : "s"} touched (estimate)`}
                  </span>
                  {canPublish && v.status === "PUBLISHED" && idx !== 0 && (
                    <RevertButton versionId={v.id} revalidate={revalidate} />
                  )}
                </div>
                {v.note && <p className="mt-1 text-neutral-500">{v.note}</p>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function RevertButton({ versionId, revalidate }: { versionId: string; revalidate: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<ActionState, FormData>(revertToVersionAction, undefined);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded border border-neutral-300 px-2 py-1 text-xs text-neutral-700 hover:border-neutral-500"
      >
        Revert to this
      </button>
    );
  }

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="versionId" value={versionId} />
      <input type="hidden" name="revalidate" value={revalidate} />
      <input
        name="note"
        required
        placeholder="Reason for reverting"
        className="rounded border border-neutral-300 bg-white px-2 py-1 text-xs text-neutral-900"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded bg-red-700 px-2 py-1 text-xs text-white hover:bg-red-600 disabled:opacity-60"
      >
        {pending ? "Reverting…" : "Confirm"}
      </button>
      {state?.error && <p className="text-xs text-red-600">{state.error}</p>}
    </form>
  );
}
