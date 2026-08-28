import Link from "next/link";
import type { ReactNode } from "react";
import { requireRole, ACCOUNT_DANGEROUS_ACTION_ROLES } from "@/lib/auth/rbac";
import { previewMerge } from "@/lib/accounts/merge";
import { MergeConfirmForm } from "./merge-confirm-form";

export const dynamic = "force-dynamic";

export default async function MergeAccountPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ with?: string }>;
}) {
  await requireRole(ACCOUNT_DANGEROUS_ACTION_ROLES);
  const { id: primaryId } = await params;
  const { with: secondaryId } = await searchParams;

  const preview = secondaryId ? await previewMerge(primaryId, secondaryId) : null;

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/accounts/${primaryId}`} className="text-sm text-neutral-500 hover:text-neutral-200">
          ← Account
        </Link>
        <h1 className="mt-1 text-lg font-semibold text-neutral-100">Merge into this account</h1>
        <p className="text-sm text-neutral-500">
          ACCT-08: this account ({primaryId}) is the PRIMARY that survives. Enter the id of the
          SECONDARY (losing) account below to preview what would move — nothing is written until you
          confirm. Both ids keep existing afterwards; the secondary just redirects readers here.
        </p>
      </div>

      <form className="flex flex-wrap items-end gap-3 rounded border border-neutral-800 p-4">
        <div className="flex-1 min-w-64">
          <label className="block text-xs text-neutral-500">Secondary (losing) account id</label>
          <input
            name="with"
            defaultValue={secondaryId}
            placeholder="cuid of the account to merge in"
            className="mt-1 w-full rounded border border-neutral-700 bg-neutral-950 px-2 py-1 text-sm text-neutral-100"
          />
        </div>
        <button
          type="submit"
          className="rounded bg-neutral-100 px-3 py-1.5 text-sm font-medium text-neutral-900 hover:bg-white"
        >
          Preview
        </button>
      </form>

      {preview && preview.error && (
        <p className="rounded border border-red-900/50 bg-red-950/20 px-4 py-3 text-sm text-red-300">
          {preview.error}
        </p>
      )}

      {preview && !preview.error && preview.primary && preview.secondary && (
        <div className="space-y-4">
          <div className="rounded border border-neutral-800 p-4 text-sm text-neutral-300">
            <p>
              <span className="text-neutral-500">Primary (keeps this id, survives):</span>{" "}
              {preview.primary.name} · {preview.primary.email} · {preview.primary.id}
            </p>
            <p>
              <span className="text-neutral-500">Secondary (id kept, but redirects here after merge):</span>{" "}
              {preview.secondary.name} · {preview.secondary.email} · {preview.secondary.id}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
            <PreviewCard title="Garages owned" count={preview.garages.length}>
              {preview.garages.map((g) => (
                <li key={g.id}>{g.name}</li>
              ))}
            </PreviewCard>
            <PreviewCard title="Garage memberships" count={preview.garageMemberships.length}>
              {preview.garageMemberships.map((g) => (
                <li key={g.id}>
                  {g.garageName} ({g.role})
                </li>
              ))}
            </PreviewCard>
            <PreviewCard title="Vehicle memberships" count={preview.vehicleMemberships.length}>
              {preview.vehicleMemberships.map((v) => (
                <li key={v.id}>{v.plate}</li>
              ))}
            </PreviewCard>
            <PreviewCard title="Workshops owned" count={preview.workshops.length}>
              {preview.workshops.map((w) => (
                <li key={w.id}>{w.name}</li>
              ))}
            </PreviewCard>
            <PreviewCard title="Workshop memberships" count={preview.workshopMemberships.length}>
              {preview.workshopMemberships.map((w) => (
                <li key={w.id}>
                  {w.workshopName} ({w.role})
                </li>
              ))}
            </PreviewCard>
            <PreviewCard title="Subscriptions" count={preview.subscriptions.length}>
              {preview.subscriptions.map((s) => (
                <li key={s.id}>{s.status}</li>
              ))}
            </PreviewCard>
            <PreviewCard title="Notifications" count={preview.notifications.length}>
              {preview.notifications.map((n) => (
                <li key={n.id} className="truncate">
                  {n.title}
                </li>
              ))}
            </PreviewCard>
          </div>

          <MergeConfirmForm primaryId={preview.primary.id} secondaryId={preview.secondary.id} />
        </div>
      )}
    </div>
  );
}

function PreviewCard({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: ReactNode;
}) {
  return (
    <div className="rounded border border-neutral-800 p-3">
      <p className="text-xs text-neutral-500">
        {title} ({count})
      </p>
      <ul className="mt-1 max-h-24 space-y-0.5 overflow-y-auto text-sm text-neutral-300">
        {count === 0 ? <li className="text-neutral-600">None</li> : children}
      </ul>
    </div>
  );
}
