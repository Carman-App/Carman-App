import { prisma } from "@/lib/prisma";
import { requireRole, ADMIN_MANAGEMENT_ROLES, roleLabel, ROLE_DESCRIPTIONS } from "@/lib/auth/rbac";
import { AdminRole } from "@/generated/prisma/enums";
import { formatDateTime } from "@/lib/format";
import { updateAdminRole, toggleAdminDisabled, forceSignOutAnySession } from "./actions";
import CreateAdminForm from "./create-admin-form";

export const dynamic = "force-dynamic";

async function getAdmins() {
  return prisma.adminUser.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      sessions: {
        where: { revokedAt: null, expiresAt: { gt: new Date() } },
        orderBy: { lastSeenAt: "desc" },
      },
    },
  });
}

export default async function AdminUsersPage() {
  const me = await requireRole(ADMIN_MANAGEMENT_ROLES);
  const admins = await getAdmins();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-neutral-900">Admins & roles</h1>
        <p className="text-sm text-neutral-500">
          Owner-only. Every create/role-change/disable here is written to the audit log (AUD-04). A role change takes effect once a second admin approves it in Approvals (AUD-03).
        </p>
      </div>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {(Object.values(AdminRole) as AdminRole[]).map((role) => (
          <div key={role} className="rounded border border-neutral-200 p-3">
            <p className="text-sm font-medium text-neutral-900">{roleLabel(role)}</p>
            <p className="mt-1 text-xs text-neutral-500">Can: {ROLE_DESCRIPTIONS[role].can}</p>
            <p className="mt-1 text-xs text-neutral-500">Cannot: {ROLE_DESCRIPTIONS[role].cannot}</p>
          </div>
        ))}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-medium text-neutral-600">Add an admin</h2>
        <CreateAdminForm />
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-medium text-neutral-600">All admins</h2>
        <div className="overflow-x-auto rounded border border-neutral-200">
          <table className="w-full min-w-max text-left text-sm">
            <thead className="bg-neutral-50 text-neutral-600">
              <tr>
                <th className="whitespace-nowrap px-4 py-2 font-medium">Name</th>
                <th className="whitespace-nowrap px-4 py-2 font-medium">Email</th>
                <th className="whitespace-nowrap px-4 py-2 font-medium">Role</th>
                <th className="whitespace-nowrap px-4 py-2 font-medium">Status</th>
                <th className="whitespace-nowrap px-4 py-2 font-medium">Live sessions</th>
                <th className="whitespace-nowrap px-4 py-2 font-medium">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {admins.map((a) => {
                const isSelf = a.id === me.adminId;
                return (
                  <tr key={a.id} className="align-top hover:bg-neutral-100">
                    <td className="whitespace-nowrap px-4 py-2">
                      {a.name} {isSelf && <span className="text-xs text-neutral-500">(you)</span>}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2">{a.email}</td>
                    <td className="whitespace-nowrap px-4 py-2">
                      <form action={updateAdminRole} className="flex items-center gap-2">
                        <input type="hidden" name="adminId" value={a.id} />
                        <select
                          name="role"
                          defaultValue={a.role}
                          disabled={isSelf}
                          className="rounded border border-neutral-300 bg-white px-2 py-1 text-xs text-neutral-900 disabled:opacity-50"
                        >
                          {(Object.values(AdminRole) as AdminRole[]).map((r) => (
                            <option key={r} value={r}>
                              {roleLabel(r)}
                            </option>
                          ))}
                        </select>
                        {!isSelf && (
                          <button type="submit" className="text-xs text-neutral-600 hover:underline">
                            Save
                          </button>
                        )}
                      </form>
                    </td>
                    <td className="whitespace-nowrap px-4 py-2">
                      {a.disabledAt ? (
                        <span className="text-red-600">Disabled</span>
                      ) : (
                        <span className="text-emerald-600">Active</span>
                      )}
                      {!isSelf && (
                        <form action={toggleAdminDisabled} className="mt-1">
                          <input type="hidden" name="adminId" value={a.id} />
                          <button type="submit" className="text-xs text-neutral-600 hover:underline">
                            {a.disabledAt ? "Re-enable" : "Disable"}
                          </button>
                        </form>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      {a.sessions.length === 0 && <span className="text-neutral-500">None</span>}
                      <ul className="space-y-1">
                        {a.sessions.map((s) => (
                          <li key={s.id} className="flex items-center gap-2 text-xs text-neutral-600">
                            <span>{s.ipAddress ?? "unknown IP"} · {formatDateTime(s.lastSeenAt)}</span>
                            <form action={forceSignOutAnySession}>
                              <input type="hidden" name="sessionId" value={s.id} />
                              <button type="submit" className="text-red-600 hover:underline">
                                Force sign-out
                              </button>
                            </form>
                          </li>
                        ))}
                      </ul>
                    </td>
                    <td className="whitespace-nowrap px-4 py-2">{formatDateTime(a.createdAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
