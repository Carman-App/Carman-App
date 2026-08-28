import Link from "next/link";
import { formatDateTime, formatMoney, titleCase } from "@/lib/format";
import { requireRole, WORK_ROLES } from "@/lib/auth/rbac";
import { getWorkshopSummaries } from "@/lib/work/workshop-summary";
import { DataTable } from "@/components/data-table";

export const dynamic = "force-dynamic";

export default async function WorkshopsPage() {
  await requireRole(WORK_ROLES);
  const workshops = await getWorkshopSummaries();

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-neutral-900">Workshops</h1>
          <p className="text-sm text-neutral-500">
            Every mechanic/workshop, with bench size, jobs by state, invoiced value, collection rate,
            and last activity.
          </p>
        </div>
        <Link
          href="/work"
          className="whitespace-nowrap rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:border-neutral-500"
        >
          Work overview →
        </Link>
      </div>

      <p className="rounded border border-neutral-200 bg-neutral-100 px-3 py-2 text-xs text-neutral-500">
        <strong className="text-neutral-600">Type</strong> is inferred, not stored: a workshop has no
        independent/workshop field in the schema, so a single-member workshop (just the owner) is
        labelled &ldquo;Independent&rdquo; here and anything with more staff &ldquo;Workshop&rdquo;.{" "}
        <strong className="text-neutral-600">Region</strong> is the owning account&rsquo;s country
        region, the closest available proxy — Workshop itself has no town/address field yet.
      </p>

      <DataTable
        rows={workshops}
        href={(row) => `/workshops/${row.id}`}
        emptyLabel="No workshops yet."
        columns={[
          { header: "Name", cell: (row) => row.name },
          { header: "Owner", cell: (row) => row.ownerName },
          { header: "Type (inferred)", cell: (row) => row.inferredType },
          { header: "Region (proxy)", cell: (row) => row.ownerRegion },
          { header: "Bench", cell: (row) => row.benchSize },
          {
            header: "Jobs by state",
            cell: (row) => {
              const entries = Object.entries(row.jobsByStatus);
              if (entries.length === 0) return "—";
              return (
                <span className="text-xs text-neutral-600">
                  {entries.map(([status, count]) => `${titleCase(status)}: ${count}`).join(", ")}
                </span>
              );
            },
          },
          { header: "Invoiced", cell: (row) => formatMoney(row.invoicedValue) },
          {
            header: "Collection rate",
            cell: (row) => (row.collectionRate == null ? "—" : `${(row.collectionRate * 100).toFixed(0)}%`),
          },
          { header: "Last activity", cell: (row) => (row.lastActivityAt ? formatDateTime(row.lastActivityAt) : "—") },
        ]}
      />
    </div>
  );
}
