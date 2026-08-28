import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { DataTable } from "@/components/data-table";
import { formatDate } from "@/lib/format";
import { requireRole, ACCOUNTS_ROLES } from "@/lib/auth/rbac";
import { REGION_LABELS } from "@/lib/region";

export const dynamic = "force-dynamic";

type SortKey = "activity" | "members" | "vehicles" | "records";

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "activity", label: "Last activity" },
  { key: "members", label: "Members" },
  { key: "vehicles", label: "Vehicles" },
  { key: "records", label: "Records" },
];

type GarageRow = {
  id: string;
  name: string;
  location: string;
  ownerName: string;
  ownerAccountId: string;
  memberCount: number;
  vehicleCount: number;
  recordCount: number;
  lastActivity: Date;
  plan: string;
  country: string;
};

async function getGarageRows(): Promise<GarageRow[]> {
  const garages = await prisma.garage.findMany({
    include: {
      owner: {
        include: {
          user: true,
          subscriptions: { orderBy: { createdAt: "desc" }, take: 1, include: { plan: true } },
        },
      },
      vehicles: { select: { id: true, updatedAt: true } },
      _count: { select: { members: { where: { removedAt: null } }, vehicles: true } },
    },
    take: 200,
  });

  const vehicleIds = garages.flatMap((g) => g.vehicles.map((v) => v.id));

  // GAR-01 "record count" (sum of fuel+service+repair+expense+odometer rows)
  // and "last activity" (max date across those same rows) — one groupBy per
  // record table (5 queries total, not per garage) rather than N+1 queries.
  const [fuelAgg, serviceAgg, repairAgg, expenseAgg, odoAgg] = await Promise.all([
    prisma.fuelRecord.groupBy({
      by: ["vehicleId"],
      where: { vehicleId: { in: vehicleIds }, deletedAt: null },
      _count: { _all: true },
      _max: { date: true },
    }),
    prisma.serviceRecord.groupBy({
      by: ["vehicleId"],
      where: { vehicleId: { in: vehicleIds }, deletedAt: null },
      _count: { _all: true },
      _max: { date: true },
    }),
    prisma.repairRecord.groupBy({
      by: ["vehicleId"],
      where: { vehicleId: { in: vehicleIds }, deletedAt: null },
      _count: { _all: true },
      _max: { date: true },
    }),
    prisma.expenseRecord.groupBy({
      by: ["vehicleId"],
      where: { vehicleId: { in: vehicleIds }, deletedAt: null },
      _count: { _all: true },
      _max: { date: true },
    }),
    prisma.odometerReading.groupBy({
      by: ["vehicleId"],
      where: { vehicleId: { in: vehicleIds } },
      _count: { _all: true },
      _max: { date: true },
    }),
  ]);

  const perVehicle = new Map<string, { count: number; maxDate: Date | null }>();
  for (const agg of [fuelAgg, serviceAgg, repairAgg, expenseAgg, odoAgg]) {
    for (const row of agg) {
      const cur = perVehicle.get(row.vehicleId) ?? { count: 0, maxDate: null };
      cur.count += row._count._all;
      const maxDate = row._max.date;
      if (maxDate && (!cur.maxDate || maxDate > cur.maxDate)) cur.maxDate = maxDate;
      perVehicle.set(row.vehicleId, cur);
    }
  }

  return garages.map((g) => {
    let recordCount = 0;
    let lastActivity = g.updatedAt;
    for (const v of g.vehicles) {
      const agg = perVehicle.get(v.id);
      if (agg) {
        recordCount += agg.count;
        if (agg.maxDate && agg.maxDate > lastActivity) lastActivity = agg.maxDate;
      }
      if (v.updatedAt > lastActivity) lastActivity = v.updatedAt;
    }

    const currentSub = g.owner.subscriptions[0];

    return {
      id: g.id,
      name: g.name,
      location: g.location,
      ownerName: g.owner.user.name,
      ownerAccountId: g.ownerId,
      memberCount: g._count.members,
      vehicleCount: g._count.vehicles,
      recordCount,
      lastActivity,
      plan: currentSub ? currentSub.plan.name : "No subscription",
      country: REGION_LABELS[g.owner.region],
    };
  });
}

function sortRows(rows: GarageRow[], sort: SortKey): GarageRow[] {
  const sorted = [...rows];
  switch (sort) {
    case "members":
      sorted.sort((a, b) => b.memberCount - a.memberCount);
      break;
    case "vehicles":
      sorted.sort((a, b) => b.vehicleCount - a.vehicleCount);
      break;
    case "records":
      sorted.sort((a, b) => b.recordCount - a.recordCount);
      break;
    case "activity":
    default:
      sorted.sort((a, b) => b.lastActivity.getTime() - a.lastActivity.getTime());
      break;
  }
  return sorted;
}

export default async function GaragesPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string }>;
}) {
  await requireRole(ACCOUNTS_ROLES);
  const { sort: sortParam } = await searchParams;
  const sort: SortKey = SORT_OPTIONS.some((o) => o.key === sortParam) ? (sortParam as SortKey) : "activity";

  const rows = sortRows(await getGarageRows(), sort);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-neutral-900">Garages</h1>
          <p className="text-sm text-neutral-500">
            Every garage, its size, and its last activity. Default order is most recently active
            first.
          </p>
        </div>
        <Link
          href="/garages/duplicate-plates"
          className="whitespace-nowrap rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:border-neutral-500"
        >
          Duplicate plates →
        </Link>
      </div>

      <div className="flex items-center gap-3 text-xs text-neutral-500">
        <span>Sort by:</span>
        {SORT_OPTIONS.map((o) => (
          <Link
            key={o.key}
            href={o.key === "activity" ? "/garages" : `/garages?sort=${o.key}`}
            className={
              sort === o.key
                ? "rounded border border-neutral-400 px-2 py-0.5 text-neutral-900"
                : "rounded border border-transparent px-2 py-0.5 text-neutral-500 hover:text-neutral-700"
            }
          >
            {o.label}
          </Link>
        ))}
      </div>

      <DataTable
        rows={rows}
        href={(row) => `/garages/${row.id}`}
        emptyLabel="No garages yet."
        columns={[
          { header: "Name", cell: (row) => row.name },
          { header: "Location", cell: (row) => row.location },
          { header: "Country", cell: (row) => row.country },
          { header: "Owner", cell: (row) => row.ownerName },
          { header: "Plan", cell: (row) => row.plan },
          { header: "Members", cell: (row) => row.memberCount },
          { header: "Vehicles", cell: (row) => row.vehicleCount },
          { header: "Records", cell: (row) => row.recordCount },
          { header: "Last activity", cell: (row) => formatDate(row.lastActivity) },
        ]}
      />
    </div>
  );
}
