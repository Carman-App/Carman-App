import { prisma } from "@/lib/prisma";
import { requireRole, CONFIG_ROLES } from "@/lib/auth/rbac";
import { DataTable } from "@/components/data-table";
import { Section } from "@/components/detail-view";
import { formatDateTime } from "@/lib/format";
import { ConfigTabs } from "../config-tabs";
import { MobileGapBanner } from "../mobile-gap-banner";
import { GoToFlagForm } from "./go-to-flag-form";

export const dynamic = "force-dynamic";

export default async function FlagsPage() {
  await requireRole(CONFIG_ROLES);

  const flags = await prisma.featureFlag.findMany({
    include: { _count: { select: { exposures: true } } },
    orderBy: { key: "asc" },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-neutral-900">Configuration</h1>
        <p className="text-sm text-neutral-500">CFG-05 Feature flags — audience targeting, off switch, exposures.</p>
      </div>

      <ConfigTabs active="flags" />

      <MobileGapBanner>
        Nothing in mobile or the API evaluates a flag today, so exposure counts below stay at zero for every flag
        until a consumer is wired up to check flags and record an exposure. Authoring/publishing here is real and
        versioned regardless.
      </MobileGapBanner>

      <Section title="Flags">
        <DataTable
          rows={flags}
          emptyLabel="No flags yet — create one below."
          href={(f) => `/config/flags/${f.key}`}
          columns={[
            { header: "Key", cell: (f) => f.key },
            { header: "Description", cell: (f) => f.description ?? "—" },
            { header: "Status", cell: (f) => (f.isEnabled ? "Enabled" : "Disabled") },
            {
              header: "Audience",
              cell: (f) => {
                const a = f.audience as { accountIds?: string[]; countries?: string[]; cohort?: string } | null;
                if (!a) return "Everyone";
                if (a.accountIds) return `${a.accountIds.length} account(s)`;
                if (a.countries) return a.countries.join(", ");
                if (a.cohort) return `Cohort: ${a.cohort}`;
                return "Everyone";
              },
            },
            { header: "Exposures", cell: (f) => f._count.exposures },
            { header: "Updated", cell: (f) => formatDateTime(f.updatedAt) },
          ]}
        />
        <GoToFlagForm />
      </Section>
    </div>
  );
}
