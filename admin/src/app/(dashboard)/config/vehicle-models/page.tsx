import { prisma } from "@/lib/prisma";
import { requireRole, CONFIG_ROLES } from "@/lib/auth/rbac";
import { DataTable } from "@/components/data-table";
import { Section } from "@/components/detail-view";
import { formatDateTime } from "@/lib/format";
import { VehicleModelSubmissionStatus } from "@/generated/prisma/enums";
import { ConfigTabs } from "../config-tabs";
import { ReviewControls } from "./review-form";

export const dynamic = "force-dynamic";

export default async function VehicleModelsPage() {
  await requireRole(CONFIG_ROLES);

  const [pending, decided] = await Promise.all([
    prisma.userSubmittedVehicleModel.findMany({
      where: { status: VehicleModelSubmissionStatus.PENDING },
      orderBy: { createdAt: "asc" },
    }),
    prisma.userSubmittedVehicleModel.findMany({
      where: { status: { not: VehicleModelSubmissionStatus.PENDING } },
      orderBy: { reviewedAt: "desc" },
      take: 50,
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-neutral-900">Configuration</h1>
        <p className="text-sm text-neutral-500">CFG-04 Make/model review queue.</p>
      </div>

      <ConfigTabs active="vehicle-models" />

      <div className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
        Real, deliberate gap: the mobile app&rsquo;s make/model picker (<code>mobile/src/data/vehicleCatalog.ts</code>
        ) only lets a user pick from the existing fixed catalogue — there is no &ldquo;type your own&rdquo; path
        anywhere in the mobile app today, so <strong>nothing populates this table</strong>. This queue exists so
        the review mechanism is ready for when that submission path is added; the empty state below is expected,
        not a bug. Approving, rejecting, or merging a submission here also does not write back to
        <code> vehicleCatalog.ts</code> — that stays a manual code change either way.
      </div>

      <Section title={`Pending (${pending.length})`}>
        <DataTable
          rows={pending}
          emptyLabel="Nothing pending — expected, since nothing in the mobile app can submit one yet."
          columns={[
            { header: "Type", cell: (s) => s.vehicleType },
            { header: "Make", cell: (s) => s.make },
            { header: "Model", cell: (s) => s.model },
            { header: "Submitted by account", cell: (s) => s.submittedByAccountId ?? "—" },
            { header: "Submitted", cell: (s) => formatDateTime(s.createdAt) },
            { header: "Review", cell: (s) => <ReviewControls submissionId={s.id} /> },
          ]}
        />
      </Section>

      <Section title="Recently decided">
        <DataTable
          rows={decided}
          emptyLabel="No decisions yet."
          columns={[
            { header: "Type", cell: (s) => s.vehicleType },
            { header: "Make", cell: (s) => s.make },
            { header: "Model", cell: (s) => s.model },
            { header: "Status", cell: (s) => s.status },
            {
              header: "Merged into",
              cell: (s) => (s.mergedIntoMake ? `${s.mergedIntoMake} ${s.mergedIntoModel ?? ""}`.trim() : "—"),
            },
            { header: "Reviewed", cell: (s) => formatDateTime(s.reviewedAt) },
            { header: "Note", cell: (s) => s.reviewNote ?? "—" },
          ]}
        />
      </Section>
    </div>
  );
}
