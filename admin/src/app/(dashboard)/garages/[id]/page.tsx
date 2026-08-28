import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { DetailView, Section } from "@/components/detail-view";
import { DataTable } from "@/components/data-table";
import { Badge } from "@/components/badge";
import { formatDate, formatDateTime } from "@/lib/format";
import { requireRole, ACCOUNTS_ROLES, GARAGE_TRANSFER_ROLES } from "@/lib/auth/rbac";
import { MemberRemovePanel, type RemovableMember } from "./member-remove-panel";
import { TransferPanel, type PendingTransfer, type TransferMemberOption } from "./transfer-panel";

export const dynamic = "force-dynamic";

async function getGarage(id: string) {
  return prisma.garage.findUnique({
    where: { id },
    include: {
      owner: { include: { user: true } },
      members: { include: { account: { include: { user: true } } }, orderBy: { joinedAt: "asc" } },
      invitations: true,
      vehicles: true,
    },
  });
}

async function getAdminNames(ids: (string | null | undefined)[]): Promise<Map<string, string>> {
  const uniqueIds = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  if (uniqueIds.length === 0) return new Map();
  const admins = await prisma.adminUser.findMany({
    where: { id: { in: uniqueIds } },
    select: { id: true, name: true, email: true },
  });
  return new Map(admins.map((a) => [a.id, `${a.name} (${a.email})`]));
}

async function getAccountNames(ids: (string | null | undefined)[]): Promise<Map<string, string>> {
  const uniqueIds = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  if (uniqueIds.length === 0) return new Map();
  const accounts = await prisma.account.findMany({
    where: { id: { in: uniqueIds } },
    include: { user: true },
  });
  return new Map(accounts.map((a) => [a.id, `${a.user.name} (${a.user.email})`]));
}

export default async function GarageDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireRole(ACCOUNTS_ROLES);
  const { id } = await params;
  const garage = await getGarage(id);
  if (!garage) notFound();

  const currentMembers = garage.members.filter((m) => !m.removedAt);
  const formerMembers = garage.members.filter((m) => m.removedAt);

  // GAR-02: resolve who invited each member. invitedByAccountId points at an
  // Account (whoever sent the invite), which may not still be a current
  // member — so this is resolved separately rather than just looking inside
  // `members`. Older rows may predate this column and are honestly shown as
  // "not recorded" rather than guessed at.
  const inviterAccountNames = await getAccountNames(garage.members.map((m) => m.invitedByAccountId));
  const removedByAdminNames = await getAdminNames(formerMembers.map((m) => m.removedByAdminId));

  // GAR-07: pending ownership-handover requests for this garage.
  const pendingApprovalRows = await prisma.twoPersonApproval.findMany({
    where: { entityType: "Garage", entityId: garage.id, action: "garage.transfer_owner", status: "PENDING" },
    orderBy: { requestedAt: "desc" },
  });
  const requesterNames = await getAdminNames(pendingApprovalRows.map((a) => a.requestedByAdminId));
  const newOwnerIds = pendingApprovalRows.map((a) => (a.payload as { newOwnerAccountId?: string }).newOwnerAccountId);
  const newOwnerNames = await getAccountNames(newOwnerIds);

  const pendingTransfers: PendingTransfer[] = pendingApprovalRows.map((a) => {
    const payload = a.payload as { newOwnerAccountId: string };
    return {
      id: a.id,
      requestedAt: a.requestedAt,
      requestedByAdminId: a.requestedByAdminId,
      requestedByLabel: requesterNames.get(a.requestedByAdminId) ?? a.requestedByAdminId,
      reason: a.reason,
      newOwnerAccountId: payload.newOwnerAccountId,
      newOwnerLabel: newOwnerNames.get(payload.newOwnerAccountId) ?? payload.newOwnerAccountId,
    };
  });

  const removableMembers: RemovableMember[] = currentMembers.map((m) => ({
    id: m.id,
    label: `${m.displayName || m.account.user.name} (${m.role})`,
  }));

  const transferMemberOptions: TransferMemberOption[] = currentMembers
    .filter((m) => m.accountId !== garage.ownerId)
    .map((m) => ({
      accountId: m.accountId,
      label: m.displayName || m.account.user.name,
    }));

  return (
    <div className="space-y-6">
      <div>
        <Link href="/garages" className="text-sm text-neutral-500 hover:text-neutral-800">
          ← Garages
        </Link>
        <h1 className="mt-1 text-lg font-semibold text-neutral-900">{garage.name}</h1>
      </div>

      <DetailView
        title="Garage"
        fields={[
          { label: "Location", value: garage.location },
          {
            label: "Owner",
            value: (
              <Link href={`/accounts/${garage.ownerId}`} className="hover:underline">
                {garage.owner.user.name}
              </Link>
            ),
          },
          { label: "Created", value: formatDateTime(garage.createdAt) },
          { label: "Garage ID", value: garage.id },
        ]}
      />

      <Section title="Vehicles">
        <DataTable
          rows={garage.vehicles}
          href={(r) => `/vehicles/${r.id}`}
          emptyLabel="No vehicles yet."
          columns={[
            { header: "Vehicle", cell: (r) => `${r.year} ${r.make} ${r.model}` },
            { header: "Plate", cell: (r) => r.plate },
            { header: "Type", cell: (r) => <Badge value={r.type} /> },
          ]}
        />
      </Section>

      <Section title="Members">
        <DataTable
          rows={currentMembers}
          href={(r) => `/accounts/${r.accountId}`}
          emptyLabel="Only the owner, so far."
          columns={[
            { header: "Name", cell: (r) => r.displayName || r.account.user.name },
            { header: "Role", cell: (r) => <Badge value={r.role} /> },
            { header: "Joined", cell: (r) => formatDate(r.joinedAt) },
            {
              header: "Invited by",
              cell: (r) =>
                r.invitedByAccountId
                  ? (inviterAccountNames.get(r.invitedByAccountId) ?? r.invitedByAccountId)
                  : "Not recorded (predates invite tracking, or joined as owner)",
            },
          ]}
        />
        <MemberRemovePanel members={removableMembers} />
      </Section>

      {formerMembers.length > 0 && (
        <Section title="Former members">
          <div className="overflow-x-auto rounded border border-neutral-200 bg-neutral-50">
            <table className="w-full min-w-max text-left text-sm">
              <thead className="bg-neutral-50 text-neutral-500">
                <tr>
                  <th className="whitespace-nowrap px-4 py-2 font-medium">Name</th>
                  <th className="whitespace-nowrap px-4 py-2 font-medium">Role</th>
                  <th className="whitespace-nowrap px-4 py-2 font-medium">Joined</th>
                  <th className="whitespace-nowrap px-4 py-2 font-medium">Removed</th>
                  <th className="whitespace-nowrap px-4 py-2 font-medium">Removed by</th>
                  <th className="whitespace-nowrap px-4 py-2 font-medium">Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 text-neutral-500">
                {formerMembers.map((m) => (
                  <tr key={m.id}>
                    <td className="whitespace-nowrap px-4 py-2">{m.displayName || m.account.user.name}</td>
                    <td className="whitespace-nowrap px-4 py-2">
                      <Badge value={m.role} />
                    </td>
                    <td className="whitespace-nowrap px-4 py-2">{formatDate(m.joinedAt)}</td>
                    <td className="whitespace-nowrap px-4 py-2">{m.removedAt ? formatDate(m.removedAt) : "—"}</td>
                    <td className="whitespace-nowrap px-4 py-2">
                      {(m.removedByAdminId && removedByAdminNames.get(m.removedByAdminId)) ?? m.removedByAdminId ?? "—"}
                    </td>
                    <td className="max-w-xs truncate px-4 py-2" title={m.removedReason ?? undefined}>
                      {m.removedReason ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      <Section title="Pending invitations">
        <DataTable
          rows={garage.invitations.filter((i) => i.status === "PENDING")}
          emptyLabel="No pending invitations."
          columns={[
            { header: "Email", cell: (r) => r.email },
            { header: "Role", cell: (r) => <Badge value={r.role} /> },
            { header: "Expires", cell: (r) => formatDate(r.expiresAt) },
          ]}
        />
      </Section>

      {GARAGE_TRANSFER_ROLES.includes(session.role) && (
        <Section title="Ownership handover (GAR-07)">
          <TransferPanel
            garageId={garage.id}
            currentOwnerLabel={garage.owner.user.name}
            memberOptions={transferMemberOptions}
            pendingTransfers={pendingTransfers}
            currentAdminId={session.adminId}
          />
        </Section>
      )}
    </div>
  );
}
