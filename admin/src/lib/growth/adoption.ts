import "server-only";
import { prisma } from "@/lib/prisma";
import { fetchRecords, type DateRange } from "./definitions";

// GROW-06 — distinct accounts using each of records/documents/reports/
// project vehicles/inspections/transfers in the last 30 days, each with a
// trend vs. the prior 30 days.

export type FeatureKey = "records" | "documents" | "reports" | "projects" | "inspections" | "transfers";

export const FEATURE_LABELS: Record<FeatureKey, string> = {
  records: "Records (fuel/service/repair/expense/odometer)",
  documents: "Documents",
  reports: "Reports",
  projects: "Project vehicles (build projects)",
  inspections: "Inspections",
  transfers: "Vehicle transfers",
};

async function distinctAccountsUsingRecords(range: DateRange): Promise<number> {
  const records = await fetchRecords(range);
  return new Set(records.map((r) => r.accountId).filter((id): id is string => id != null)).size;
}

async function distinctAccountsUsingDocuments(range: DateRange): Promise<number> {
  const rows = await prisma.document.findMany({
    where: { addedAt: { gte: range.start, lt: range.end }, deletedAt: null, uploadedByAccountId: { not: null } },
    select: { uploadedByAccountId: true },
    distinct: ["uploadedByAccountId"],
  });
  return rows.length;
}

async function distinctAccountsUsingReports(range: DateRange): Promise<number> {
  const rows = await prisma.report.findMany({
    where: { generatedAt: { gte: range.start, lt: range.end }, generatedByAccountId: { not: null } },
    select: { generatedByAccountId: true },
    distinct: ["generatedByAccountId"],
  });
  return rows.length;
}

// Project has no account column of its own — attributed to the vehicle's
// owning account (Garage.ownerId), same as the "vehicle added" funnel step.
async function distinctAccountsUsingProjects(range: DateRange): Promise<number> {
  const rows = await prisma.project.findMany({
    where: { createdAt: { gte: range.start, lt: range.end } },
    select: { vehicle: { select: { garage: { select: { ownerId: true } } } } },
  });
  return new Set(rows.map((r) => r.vehicle.garage.ownerId)).size;
}

// Inspection.createdByWorkshopMemberId identifies the *mechanic* (a
// WorkshopMember, on the Workshop side), not an owner-side Account — using
// it would count workshop staff, not Carma owner accounts adopting the
// feature. Attributed instead to the inspected vehicle's owning account,
// consistent with "projects"/"vehicle added" above: this treats "adoption"
// as "this owner's vehicle received the feature", not "this mechanic used
// the feature".
async function distinctAccountsUsingInspections(range: DateRange): Promise<number> {
  const rows = await prisma.inspection.findMany({
    where: { createdAt: { gte: range.start, lt: range.end } },
    select: { vehicle: { select: { garage: { select: { ownerId: true } } } } },
  });
  return new Set(rows.map((r) => r.vehicle.garage.ownerId)).size;
}

async function distinctAccountsUsingTransfers(range: DateRange): Promise<number> {
  const rows = await prisma.vehicleTransfer.findMany({
    where: { createdAt: { gte: range.start, lt: range.end } },
    select: { fromAccountId: true, toAccountId: true },
  });
  const ids = new Set<string>();
  for (const r of rows) {
    if (r.fromAccountId) ids.add(r.fromAccountId);
    if (r.toAccountId) ids.add(r.toAccountId);
  }
  return ids.size;
}

const COUNTERS: Record<FeatureKey, (range: DateRange) => Promise<number>> = {
  records: distinctAccountsUsingRecords,
  documents: distinctAccountsUsingDocuments,
  reports: distinctAccountsUsingReports,
  projects: distinctAccountsUsingProjects,
  inspections: distinctAccountsUsingInspections,
  transfers: distinctAccountsUsingTransfers,
};

export type FeatureAdoptionRow = {
  feature: FeatureKey;
  label: string;
  current: number;
  prior: number;
  trendPercent: number | null; // null when prior is 0 and current is also 0 (nothing to compare)
};

export async function getFeatureAdoption(reference: Date = new Date()): Promise<FeatureAdoptionRow[]> {
  const current: DateRange = { start: new Date(reference.getTime() - 30 * 24 * 60 * 60 * 1000), end: reference };
  const prior: DateRange = { start: new Date(current.start.getTime() - 30 * 24 * 60 * 60 * 1000), end: current.start };

  const keys = Object.keys(COUNTERS) as FeatureKey[];
  const results = await Promise.all(
    keys.map(async (feature) => {
      const [currentCount, priorCount] = await Promise.all([COUNTERS[feature](current), COUNTERS[feature](prior)]);
      return { feature, currentCount, priorCount };
    }),
  );

  return results.map(({ feature, currentCount, priorCount }) => ({
    feature,
    label: FEATURE_LABELS[feature],
    current: currentCount,
    prior: priorCount,
    trendPercent:
      priorCount === 0 ? (currentCount === 0 ? null : 100) : ((currentCount - priorCount) / priorCount) * 100,
  }));
}
