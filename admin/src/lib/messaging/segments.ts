import { prisma } from "@/lib/prisma";
import { Region } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";

/**
 * The shape stored in `Segment.definition` (COMM-01) and reused verbatim for
 * `Banner.audience` (COMM-06, "a segment-shaped filter"). This is
 * deliberately NOT a generic filter DSL — it is the small, fixed set of
 * account attributes this console can actually compute from real rows.
 * Extend this type (and segmentWhere below) if a new attribute is needed;
 * don't invent a generic query language nobody asked for.
 *
 * Supported attributes (all present keys are ANDed together; omit a key to
 * not filter on it; a null/undefined definition — Banner.audience's "null =
 * everyone" — matches every non-deleted, non-merged account):
 *
 *   region            Account.region equals this exactly.
 *   planCode          Has at least one Subscription (any status) whose
 *                      Plan.code equals this (checked via Account.subscriptions,
 *                      i.e. subject=OWNER subscriptions attached to the account
 *                      directly — workshop-subject subscriptions are not
 *                      reachable from an Account and are out of scope here).
 *   hasSubscription   Has at least one Subscription row at all (any plan).
 *                      Ignored when planCode is also set (planCode is strictly
 *                      more specific).
 *   hasVehicle        Owns a garage with >=1 vehicle, OR is an active
 *                      (non-removed) member of a garage with >=1 vehicle.
 *   minAccountAgeDays Account.createdAt is at least this many days in the past.
 *   excludeSuspended  Default true. When true (or omitted), suspended
 *                      accounts (Account.suspendedAt set) are excluded.
 *                      Set to false to explicitly include them.
 *
 * Every match additionally always excludes soft-deleted accounts
 * (deletedAt) and accounts merged away into another account
 * (mergedIntoAccountId) — those can never be legitimate send targets.
 */
export type SegmentDefinition = {
  region?: Region;
  planCode?: string;
  hasSubscription?: boolean;
  hasVehicle?: boolean;
  minAccountAgeDays?: number;
  excludeSuspended?: boolean;
};

/** Human-readable summary of a definition, used in list/detail UI. */
export function describeSegmentDefinition(definition: SegmentDefinition | null | undefined): string {
  const def = definition ?? {};
  const parts: string[] = [];
  if (def.region) parts.push(`region = ${def.region}`);
  if (def.planCode) parts.push(`plan = ${def.planCode}`);
  else if (def.hasSubscription) parts.push("has a subscription");
  if (def.hasVehicle) parts.push("has a vehicle");
  if (def.minAccountAgeDays) parts.push(`account age >= ${def.minAccountAgeDays}d`);
  if (def.excludeSuspended === false) parts.push("includes suspended");
  return parts.length > 0 ? parts.join(", ") : "Everyone";
}

export function segmentWhere(definition: SegmentDefinition | null | undefined): Prisma.AccountWhereInput {
  const def = definition ?? {};
  const where: Prisma.AccountWhereInput = {
    deletedAt: null,
    mergedIntoAccountId: null,
  };

  if (def.excludeSuspended !== false) {
    where.suspendedAt = null;
  }
  if (def.region) {
    where.region = def.region;
  }
  if (def.planCode) {
    where.subscriptions = { some: { plan: { code: def.planCode } } };
  } else if (def.hasSubscription) {
    where.subscriptions = { some: {} };
  }
  if (def.hasVehicle) {
    where.OR = [
      { garagesOwned: { some: { vehicles: { some: {} } } } },
      { garageMemberships: { some: { removedAt: null, garage: { vehicles: { some: {} } } } } },
    ];
  }
  if (def.minAccountAgeDays) {
    const cutoff = new Date(Date.now() - def.minAccountAgeDays * 24 * 60 * 60 * 1000);
    where.createdAt = { lte: cutoff };
  }

  return where;
}

export async function resolveSegmentAccountIds(
  definition: SegmentDefinition | null | undefined,
): Promise<string[]> {
  const accounts = await prisma.account.findMany({
    where: segmentWhere(definition),
    select: { id: true },
  });
  return accounts.map((a) => a.id);
}

export async function countSegment(definition: SegmentDefinition | null | undefined): Promise<number> {
  return prisma.account.count({ where: segmentWhere(definition) });
}

/** Parses the small fixed form-field set used by segment/audience builder forms into a SegmentDefinition. */
export function segmentDefinitionFromFormData(formData: FormData): SegmentDefinition {
  const def: SegmentDefinition = {};
  const region = String(formData.get("region") || "");
  if (region && (Object.values(Region) as string[]).includes(region)) {
    def.region = region as Region;
  }
  const planCode = String(formData.get("planCode") || "").trim();
  if (planCode) def.planCode = planCode;
  if (formData.get("hasSubscription") === "on") def.hasSubscription = true;
  if (formData.get("hasVehicle") === "on") def.hasVehicle = true;
  const minAge = String(formData.get("minAccountAgeDays") || "").trim();
  if (minAge && !Number.isNaN(Number(minAge))) def.minAccountAgeDays = Number(minAge);
  // Checkbox named for what checking it DOES ("include suspended accounts")
  // rather than the underlying field name, to avoid the on/off ambiguity of
  // an unchecked HTML checkbox simply not appearing in the FormData at all.
  if (formData.get("includeSuspended") === "on") def.excludeSuspended = false;
  return def;
}
