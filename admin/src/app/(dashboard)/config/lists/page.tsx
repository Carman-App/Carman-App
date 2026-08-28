import { prisma } from "@/lib/prisma";
import { requireRole, CONFIG_ROLES } from "@/lib/auth/rbac";
import { DataTable } from "@/components/data-table";
import { Section } from "@/components/detail-view";
import { ConfigTabs } from "../config-tabs";
import { MobileGapBanner } from "../mobile-gap-banner";

export const dynamic = "force-dynamic";

export default async function ListsPage() {
  await requireRole(CONFIG_ROLES);

  const lists = await prisma.configList.findMany({
    include: { _count: { select: { items: true } } },
    orderBy: { key: "asc" },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-neutral-900">Configuration</h1>
        <p className="text-sm text-neutral-500">
          CFG-03 Lists — one generic editor over every ConfigList: record categories, document types, service
          intervals, job types, towns, and cancellation/report reasons.
        </p>
      </div>

      <ConfigTabs active="lists" />

      <MobileGapBanner>
        None of these lists are read by the mobile app yet — it hardcodes its own record categories in{" "}
        <code>mobile/src/features/record/categories.ts</code>, document types in{" "}
        <code>mobile/src/types/domain.ts</code>, and has no equivalent at all for service intervals, job types,
        towns, or report reasons. Editing here is real and audit-logged, but has zero live effect until a
        follow-on change makes the mobile app fetch from these tables.
      </MobileGapBanner>

      <div className="rounded border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-600">
        Draft/publish/version-history is not wired up for lists — edits on each list&rsquo;s page go live
        immediately (still audit-logged, CONFIG_ROLES-gated).
      </div>

      <Section title="Lists">
        <DataTable
          rows={lists}
          emptyLabel="No lists seeded yet — run `npx tsx scripts/seed-config-lists.ts`."
          href={(l) => `/config/lists/${l.key}`}
          columns={[
            { header: "Key", cell: (l) => l.key },
            { header: "Label", cell: (l) => l.label },
            { header: "Items", cell: (l) => l._count.items },
          ]}
        />
      </Section>
    </div>
  );
}
