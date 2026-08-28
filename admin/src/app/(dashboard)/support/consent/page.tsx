import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Section } from "@/components/detail-view";
import { Badge } from "@/components/badge";
import { formatDateTime } from "@/lib/format";
import { requireRole, CONSENT_SESSION_ROLES } from "@/lib/auth/rbac";
import { ConsentSessionStatus } from "@/generated/prisma/enums";
import { syncExpiredConsentSessions } from "./actions";
import { RequestConsentForm } from "./request-form";
import { GrantForm, EndSessionForm } from "./consent-row-actions";
import { ConsentBanner } from "./consent-banner";

export const dynamic = "force-dynamic";

export default async function ConsentSessionsPage() {
  await requireRole(CONSENT_SESSION_ROLES);
  await syncExpiredConsentSessions();

  const sessions = await prisma.consentSession.findMany({
    include: { account: { include: { user: true } } },
    orderBy: { requestedAt: "desc" },
    take: 100,
  });

  const requestedByIds = [...new Set(sessions.map((s) => s.requestedByAdminId))];
  const admins = requestedByIds.length
    ? await prisma.adminUser.findMany({ where: { id: { in: requestedByIds } }, select: { id: true, name: true } })
    : [];
  const adminNames = new Map(admins.map((a) => [a.id, a.name]));

  const previewSession = sessions.find((s) => s.status === ConsentSessionStatus.ACTIVE && s.expiresAt);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/support" className="text-sm text-neutral-500 hover:text-neutral-800">
          ← Ticket queue
        </Link>
        <h1 className="mt-1 text-lg font-semibold text-neutral-900">
          &ldquo;See the app as the user&rdquo; — consent sessions (SUP-03)
        </h1>
      </div>

      <div className="rounded border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        <p className="font-medium">This is scaffolding only.</p>
        <p className="mt-1">
          This logs and time-boxes a consent session but is <strong>not</strong> wired to a real
          mobile-side consent handshake — no admin tool anywhere in this codebase actually reads
          this account&rsquo;s live data as a result of a session created here. There is no
          mobile-side consent flow to build against in this pass, so per AGENTS.md this page builds
          only the request/grant/time-box/audit scaffolding and the banner preview below — never an
          actual data-viewing page.
        </p>
      </div>

      <Section title="Request a session">
        <RequestConsentForm />
      </Section>

      {previewSession && (
        <Section title="Banner preview (not attached to any live view)">
          <ConsentBanner
            accountLabel={`${previewSession.account.user.name} (${previewSession.account.user.email})`}
            expiresAt={previewSession.expiresAt ?? previewSession.requestedAt}
            consentMethod={previewSession.consentMethod}
          />
        </Section>
      )}

      <Section title="Sessions">
        <div className="overflow-x-auto rounded border border-neutral-200">
          <table className="w-full min-w-max text-left text-sm">
            <thead className="bg-neutral-50 text-neutral-600">
              <tr>
                <th className="whitespace-nowrap px-4 py-2 font-medium">Account</th>
                <th className="whitespace-nowrap px-4 py-2 font-medium">Requested by</th>
                <th className="whitespace-nowrap px-4 py-2 font-medium">Status</th>
                <th className="whitespace-nowrap px-4 py-2 font-medium">Requested</th>
                <th className="whitespace-nowrap px-4 py-2 font-medium">Expires</th>
                <th className="whitespace-nowrap px-4 py-2 font-medium">Ended</th>
                <th className="whitespace-nowrap px-4 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {sessions.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-neutral-500">
                    No consent sessions logged yet.
                  </td>
                </tr>
              )}
              {sessions.map((s) => (
                <tr key={s.id}>
                  <td className="whitespace-nowrap px-4 py-2">
                    <Link href={`/accounts/${s.accountId}`} className="hover:underline">
                      {s.account.user.name}
                    </Link>
                  </td>
                  <td className="whitespace-nowrap px-4 py-2">{adminNames.get(s.requestedByAdminId) ?? s.requestedByAdminId}</td>
                  <td className="whitespace-nowrap px-4 py-2">
                    <Badge value={s.status} />
                  </td>
                  <td className="whitespace-nowrap px-4 py-2">{formatDateTime(s.requestedAt)}</td>
                  <td className="whitespace-nowrap px-4 py-2">{s.expiresAt ? formatDateTime(s.expiresAt) : "—"}</td>
                  <td className="whitespace-nowrap px-4 py-2">{s.endedAt ? formatDateTime(s.endedAt) : "—"}</td>
                  <td className="px-4 py-2">
                    {s.status === ConsentSessionStatus.REQUESTED && <GrantForm sessionId={s.id} />}
                    {s.status === ConsentSessionStatus.ACTIVE && <EndSessionForm sessionId={s.id} />}
                    {(s.status === ConsentSessionStatus.EXPIRED ||
                      s.status === ConsentSessionStatus.ENDED ||
                      s.status === ConsentSessionStatus.DENIED) && <span className="text-xs text-neutral-500">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}
