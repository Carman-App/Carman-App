import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Section } from "@/components/detail-view";
import { Badge } from "@/components/badge";
import { DataTable } from "@/components/data-table";
import { formatDateTime } from "@/lib/format";
import { requireRole, PRIVACY_ROLES } from "@/lib/auth/rbac";
import { PrivacyNav } from "./privacy-nav";
import { ExportForm } from "./export-form";

export const dynamic = "force-dynamic";

type SearchParams = { accountId?: string };

export default async function PrivacyPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireRole(PRIVACY_ROLES);
  const sp = await searchParams;

  const [requests] = await Promise.all([
    prisma.dataExportRequest.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { account: { include: { user: true } } },
    }),
  ]);

  const adminIds = [...new Set(requests.map((r) => r.requestedByAdminId))];
  const admins = adminIds.length
    ? await prisma.adminUser.findMany({ where: { id: { in: adminIds } }, select: { id: true, name: true, email: true } })
    : [];
  const adminNames = new Map(admins.map((a) => [a.id, `${a.name} (${a.email})`]));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-neutral-900">Privacy &amp; data rights</h1>
        <p className="text-sm text-neutral-500">
          Compliance-grade actions — every write here requires a stated reason and is audit-logged
          (OWNER-only, see <code>PRIVACY_ROLES</code> in <code>src/lib/auth/rbac.ts</code>).
        </p>
      </div>

      <PrivacyNav active="/privacy" />

      <Section title="One-action data export (PRIV-01)">
        <p className="text-xs text-neutral-500">
          Walks every model connected to one account — the same &ldquo;what moves&rdquo; traversal
          ACCT-08&rsquo;s merge preview uses (garages owned, garage/vehicle/workshop memberships,
          subscriptions, notifications), extended deeper: every vehicle under every garage owned or
          belonged to, and every fuel/service/repair/expense/odometer record, document, reminder,
          project, job, inspection, estimate, invoice and payment reachable through those vehicles
          or workshops. Generation is synchronous — clicking &ldquo;Generate export&rdquo; runs the
          full traversal immediately, creates a real <code>DataExportRequest</code> row (status{" "}
          <code>GENERATED</code>) with a per-model record-count summary, and audit-logs the reason.
        </p>
        <p className="rounded border border-dashed border-neutral-200 p-3 text-xs text-amber-600">
          There is no email-delivery step. Resend is a reserved, unconfigured env var
          (<code>RESEND_API_KEY</code> in <code>.env.example</code>) — &ldquo;delivered to the
          account holder&rdquo; (rather than downloaded by an admin) needs that provider wired up
          and isn&rsquo;t built here. Today the admin downloads the JSON directly; that download is
          what marks the request <code>DOWNLOADED</code>.
        </p>
        <ExportForm defaultAccountId={sp.accountId} />
      </Section>

      <Section title="Export requests (most recent 50)">
        <DataTable
          rows={requests}
          emptyLabel="No export requests yet."
          columns={[
            {
              header: "Account",
              cell: (r) => (
                <Link href={`/accounts/${r.accountId}`} className="hover:underline">
                  {r.account.user.name} ({r.account.user.email})
                </Link>
              ),
            },
            { header: "Status", cell: (r) => <Badge value={r.status} /> },
            {
              header: "Record counts",
              cell: (r) => {
                const counts = (r.recordCounts as Record<string, number> | null) ?? {};
                const total = Object.values(counts).reduce((sum, n) => sum + n, 0);
                return `${total} rows across ${Object.keys(counts).length} models`;
              },
            },
            { header: "Requested by", cell: (r) => adminNames.get(r.requestedByAdminId) ?? r.requestedByAdminId },
            { header: "Reason", cell: (r) => <span className="block max-w-xs truncate" title={r.reason}>{r.reason}</span> },
            { header: "Created", cell: (r) => formatDateTime(r.createdAt) },
            { header: "Downloaded", cell: (r) => (r.downloadedAt ? formatDateTime(r.downloadedAt) : "Not yet") },
            {
              header: "",
              cell: (r) => (
                <a href={`/privacy/export/${r.id}/download`} className="text-sky-600 hover:underline">
                  Download →
                </a>
              ),
            },
          ]}
        />
      </Section>

      <Section title="Deletion — what goes vs. stays (PRIV-02)">
        <p className="text-sm text-neutral-600">
          The printed policy (intended target vs. what actually happens today) lives on each
          account&rsquo;s own delete confirmation screen, next to the real ACCT-07 soft-delete
          action — see <Link href="/accounts" className="hover:underline">Accounts</Link> →
          an account → &ldquo;Delete this account&rdquo;. Summary: personal data/content is
          intended to be removed and financial records required for tax/accounting retention kept
          in a minimised form, once retention execution exists — today, deletion only stamps a
          reversible marker on the Account row within a 30-day grace window; nothing is actually
          scrubbed or purged.
        </p>
      </Section>
    </div>
  );
}
