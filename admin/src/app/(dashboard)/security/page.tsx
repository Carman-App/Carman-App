import { getMySessions, forceSignOutSession } from "./actions";
import { formatDateTime } from "@/lib/format";
import { requireAdmin, roleLabel } from "@/lib/auth/rbac";

export const dynamic = "force-dynamic";

export default async function SecurityPage() {
  const admin = await requireAdmin();
  const { sessions, currentSessionId } = await getMySessions();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-neutral-100">My security</h1>
        <p className="text-sm text-neutral-500">
          Signed in as {admin.email} · role: {roleLabel(admin.role)}. Two-factor authentication is
          required for every admin (AUD-05) and was verified for this session.
        </p>
      </div>

      <section className="space-y-2">
        <h2 className="text-sm font-medium text-neutral-400">Active sessions</h2>
        <div className="overflow-x-auto rounded border border-neutral-800">
          <table className="w-full min-w-max text-left text-sm">
            <thead className="bg-neutral-900 text-neutral-400">
              <tr>
                <th className="whitespace-nowrap px-4 py-2 font-medium">Started</th>
                <th className="whitespace-nowrap px-4 py-2 font-medium">Last seen</th>
                <th className="whitespace-nowrap px-4 py-2 font-medium">Expires</th>
                <th className="whitespace-nowrap px-4 py-2 font-medium">IP</th>
                <th className="whitespace-nowrap px-4 py-2 font-medium">User agent</th>
                <th className="whitespace-nowrap px-4 py-2 font-medium">Status</th>
                <th className="whitespace-nowrap px-4 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800">
              {sessions.map((s) => {
                const isCurrent = s.id === currentSessionId;
                const isLive = !s.revokedAt && s.expiresAt > new Date();
                return (
                  <tr key={s.id} className="hover:bg-neutral-900/60">
                    <td className="whitespace-nowrap px-4 py-2">{formatDateTime(s.createdAt)}</td>
                    <td className="whitespace-nowrap px-4 py-2">{formatDateTime(s.lastSeenAt)}</td>
                    <td className="whitespace-nowrap px-4 py-2">{formatDateTime(s.expiresAt)}</td>
                    <td className="whitespace-nowrap px-4 py-2">{s.ipAddress ?? "—"}</td>
                    <td className="max-w-xs truncate px-4 py-2" title={s.userAgent ?? undefined}>
                      {s.userAgent ?? "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2">
                      {!isLive ? (
                        <span className="text-neutral-500">
                          {s.revokedReason === "force_signout" ? "Signed out" : s.revokedAt ? "Ended" : "Expired"}
                        </span>
                      ) : isCurrent ? (
                        <span className="text-emerald-400">This device</span>
                      ) : (
                        <span className="text-neutral-300">Active</span>
                      )}
                      {s.isNewLocation && <span className="ml-2 text-amber-400">new location</span>}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2">
                      {isLive && !isCurrent && (
                        <form action={forceSignOutSession}>
                          <input type="hidden" name="sessionId" value={s.id} />
                          <button type="submit" className="text-xs text-red-400 hover:underline">
                            Force sign-out
                          </button>
                        </form>
                      )}
                    </td>
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
