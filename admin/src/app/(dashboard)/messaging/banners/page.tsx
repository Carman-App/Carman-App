import { prisma } from "@/lib/prisma";
import { requireRole, MESSAGING_ROLES } from "@/lib/auth/rbac";
import { DataTable } from "@/components/data-table";
import { Badge } from "@/components/badge";
import { Section } from "@/components/detail-view";
import { formatDateTime } from "@/lib/format";
import { MessagingTabs } from "../messaging-tabs";
import { NewBannerForm, ClearBannerButton } from "./banner-form";
import { describeSegmentDefinition, type SegmentDefinition } from "@/lib/messaging/segments";

export const dynamic = "force-dynamic";

export default async function BannersPage() {
  await requireRole(MESSAGING_ROLES);

  const banners = await prisma.banner.findMany({ orderBy: { createdAt: "desc" } });
  const now = new Date().getTime();

  const rows = banners.map((b) => ({
    id: b.id,
    message: b.message,
    severity: b.severity,
    audience: describeSegmentDefinition((b.audience as SegmentDefinition | null) ?? null),
    startsAt: b.startsAt,
    expiresAt: b.expiresAt,
    clearedAt: b.clearedAt,
    isActive: !b.clearedAt && b.startsAt.getTime() <= now && b.expiresAt.getTime() > now,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-neutral-900">Messaging</h1>
        <p className="text-sm text-neutral-500">In-app banners (COMM-06).</p>
      </div>

      <MessagingTabs active="banners" />

      <div className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
        No mobile/web client currently reads this table to actually render a banner — this is the admin
        authoring/management surface only. &ldquo;Clear for everyone&rdquo; sets this one row&rsquo;s
        clearedAt/clearedByAdminId, since nothing else stores per-viewer banner state to reconcile.
      </div>

      <Section title="Banners">
        <DataTable
          rows={rows}
          emptyLabel="No banners yet."
          columns={[
            { header: "Message", cell: (r) => r.message },
            { header: "Severity", cell: (r) => <Badge value={r.severity} /> },
            { header: "Audience", cell: (r) => r.audience },
            {
              header: "Status",
              cell: (r) => (r.clearedAt ? "Cleared" : r.isActive ? "Active" : "Not yet active / expired"),
            },
            { header: "Starts", cell: (r) => formatDateTime(r.startsAt) },
            { header: "Expires", cell: (r) => formatDateTime(r.expiresAt) },
            {
              header: "",
              cell: (r) => (!r.clearedAt ? <ClearBannerButton bannerId={r.id} /> : null),
            },
          ]}
        />
        <NewBannerForm />
      </Section>
    </div>
  );
}
