"use client";

import { useActionState, useState } from "react";
import { requestRoleChange, approveRoleChange, rejectRoleChange, type AdminFormState } from "./actions";
import { AdminRole } from "@/generated/prisma/enums";
import { formatDateTime } from "@/lib/format";

export type PendingRoleChange = {
  id: string;
  requestedAt: Date;
  requestedByAdminId: string;
  requestedByLabel: string;
  reason: string;
  newRole: AdminRole;
};

// AUD-03: role changes require a second OWNER-role admin's approval — the
// admin who requests it cannot also approve it (enforced server-side in
// src/lib/approvals.ts's approveAndExecute, not just hidden here).
export function RoleChangeControl({
  adminId,
  currentRole,
  roleLabel,
  isSelf,
  pending,
  currentAdminId,
}: {
  adminId: string;
  currentRole: AdminRole;
  roleLabel: (r: AdminRole) => string;
  isSelf: boolean;
  pending: PendingRoleChange | null;
  currentAdminId: string;
}) {
  if (isSelf) {
    return <span className="text-xs text-neutral-500">{roleLabel(currentRole)} (you)</span>;
  }

  if (pending) {
    return (
      <PendingRoleChangeCard
        pending={pending}
        roleLabel={roleLabel}
        isRequester={pending.requestedByAdminId === currentAdminId}
      />
    );
  }

  return <RequestForm adminId={adminId} currentRole={currentRole} roleLabel={roleLabel} />;
}

function RequestForm({
  adminId,
  currentRole,
  roleLabel,
}: {
  adminId: string;
  currentRole: AdminRole;
  roleLabel: (r: AdminRole) => string;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<AdminFormState, FormData>(requestRoleChange, undefined);

  if (!open) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-neutral-700">{roleLabel(currentRole)}</span>
        <button type="button" onClick={() => setOpen(true)} className="text-xs text-neutral-500 hover:underline">
          Change…
        </button>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-1 rounded border border-neutral-200 bg-neutral-50 p-2">
      <input type="hidden" name="adminId" value={adminId} />
      <select
        name="role"
        defaultValue={currentRole}
        className="w-full rounded border border-neutral-300 bg-white px-1 py-0.5 text-xs text-neutral-900"
      >
        {(Object.values(AdminRole) as AdminRole[]).map((r) => (
          <option key={r} value={r}>
            {roleLabel(r)}
          </option>
        ))}
      </select>
      <textarea
        name="reason"
        required
        rows={2}
        placeholder="Reason (required)"
        className="w-full rounded border border-neutral-300 bg-white px-1 py-0.5 text-xs text-neutral-900"
      />
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="text-xs font-medium text-neutral-900 underline-offset-2 hover:underline disabled:opacity-50"
        >
          {pending ? "Requesting…" : "Request change"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs text-neutral-500 hover:underline"
        >
          Cancel
        </button>
      </div>
      {state?.error && <p className="text-xs text-red-600">{state.error}</p>}
    </form>
  );
}

function PendingRoleChangeCard({
  pending,
  roleLabel,
  isRequester,
}: {
  pending: PendingRoleChange;
  roleLabel: (r: AdminRole) => string;
  isRequester: boolean;
}) {
  const [approveState, approveAction, approvePending] = useActionState<AdminFormState, FormData>(
    approveRoleChange,
    undefined,
  );
  const [rejectState, rejectAction, rejectPending] = useActionState<AdminFormState, FormData>(
    rejectRoleChange,
    undefined,
  );
  const [showReject, setShowReject] = useState(false);

  return (
    <div className="space-y-1 rounded border border-amber-200 bg-amber-50 p-2 text-xs">
      <p className="font-medium text-amber-800">Pending → {roleLabel(pending.newRole)}</p>
      <p className="text-neutral-600" title={pending.reason}>
        by {pending.requestedByLabel} · {formatDateTime(pending.requestedAt)}
      </p>

      {isRequester ? (
        <p className="text-neutral-500">Awaiting a different Owner&rsquo;s approval.</p>
      ) : (
        <form action={approveAction}>
          <input type="hidden" name="approvalId" value={pending.id} />
          <button
            type="submit"
            disabled={approvePending}
            className="font-medium text-amber-800 underline-offset-2 hover:underline disabled:opacity-50"
          >
            {approvePending ? "Approving…" : "Approve"}
          </button>
        </form>
      )}
      {approveState?.error && <p className="text-red-600">{approveState.error}</p>}

      {!showReject ? (
        <button type="button" onClick={() => setShowReject(true)} className="text-neutral-500 hover:underline">
          Reject
        </button>
      ) : (
        <form action={rejectAction} className="space-y-1">
          <input type="hidden" name="approvalId" value={pending.id} />
          <textarea
            name="reason"
            required
            rows={1}
            placeholder="Reason (required)"
            className="w-full rounded border border-neutral-300 bg-white px-1 py-0.5 text-xs text-neutral-900"
          />
          <button
            type="submit"
            disabled={rejectPending}
            className="font-medium text-red-700 underline-offset-2 hover:underline disabled:opacity-50"
          >
            {rejectPending ? "Rejecting…" : "Confirm reject"}
          </button>
          {rejectState?.error && <p className="text-red-600">{rejectState.error}</p>}
        </form>
      )}
    </div>
  );
}
