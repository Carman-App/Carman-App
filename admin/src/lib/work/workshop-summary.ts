import { prisma } from "@/lib/prisma";
import { JobStatus } from "@/generated/prisma/enums";

// WORK-01 schema gaps, handled honestly rather than invented:
//
// - There is no address/location field anywhere on Workshop, so "town" has
//   nothing real to show. The closest available proxy is the owning
//   Account's `region` (a country-level enum, not a town) — shown as such
//   and labelled "Region (proxy)" rather than "Town".
// - There is no explicit independent/workshop "type" field either. As a
//   cheap, clearly-labelled proxy: a workshop with 1 member (just the owner)
//   is inferred "Independent", anything with more staff is inferred
//   "Workshop". This is inferred, not stored — labelled "(inferred)" in the UI.

export type WorkshopSummaryRow = {
  id: string;
  name: string;
  ownerName: string;
  ownerRegion: string;
  inferredType: "Independent" | "Workshop";
  benchSize: number;
  jobsByStatus: Partial<Record<JobStatus, number>>;
  invoicedValue: number;
  collectedValue: number;
  collectionRate: number | null; // null when there's nothing invoiced yet
  lastActivityAt: Date | null;
};

/** WORK-01 — every workshop with volume: type/town proxies, bench size, jobs by state, invoiced value, collection rate, last activity. */
export async function getWorkshopSummaries(): Promise<WorkshopSummaryRow[]> {
  const workshops = await prisma.workshop.findMany({
    include: {
      owner: { include: { user: true } },
      _count: { select: { members: true } },
      jobs: { select: { status: true, createdAt: true, updatedAt: true } },
      invoices: {
        where: { deletedAt: null },
        select: {
          total: true,
          createdAt: true,
          payments: { where: { deletedAt: null }, select: { amount: true, paidAt: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return workshops.map((workshop) => {
    const jobsByStatus: Partial<Record<JobStatus, number>> = {};
    for (const job of workshop.jobs) {
      jobsByStatus[job.status] = (jobsByStatus[job.status] ?? 0) + 1;
    }

    let invoicedValue = 0;
    let collectedValue = 0;
    const activityDates: Date[] = [];
    for (const invoice of workshop.invoices) {
      invoicedValue += invoice.total.toNumber();
      activityDates.push(invoice.createdAt);
      for (const payment of invoice.payments) {
        collectedValue += payment.amount.toNumber();
        activityDates.push(payment.paidAt);
      }
    }
    for (const job of workshop.jobs) {
      activityDates.push(job.createdAt, job.updatedAt);
    }

    const lastActivityAt =
      activityDates.length > 0 ? new Date(Math.max(...activityDates.map((d) => d.getTime()))) : null;

    return {
      id: workshop.id,
      name: workshop.name,
      ownerName: workshop.owner.user.name,
      ownerRegion: workshop.owner.region,
      inferredType: workshop._count.members <= 1 ? "Independent" : "Workshop",
      benchSize: workshop._count.members,
      jobsByStatus,
      invoicedValue,
      collectedValue,
      collectionRate: invoicedValue > 0 ? collectedValue / invoicedValue : null,
      lastActivityAt,
    };
  });
}
