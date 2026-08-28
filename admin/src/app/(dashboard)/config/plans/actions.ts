"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole, CONFIG_ROLES } from "@/lib/auth/rbac";
import { writeAdminAuditLog } from "@/lib/audit";

export type ActionState = { error?: string; ok?: boolean; message?: string } | undefined;

/**
 * CFG-02 launches direct-edit-only per AGENTS.md ("if you run out of time,
 * ConfigList/PlanPrice/SubscriptionRules can launch without full
 * versioning") — Plan/PlanPrice edits below are immediate, not staged as a
 * ConfigVersion draft. They are still audit-logged like every other write
 * in this console, and still CONFIG_ROLES-gated (SUPPORT+OWNER), matching
 * this story's own risk level (catalog/pricing edits, not a publish that
 * reaches every account instantly the way CFG-01/05/08 do).
 */

function parseOptionalInt(raw: FormDataEntryValue | null): number | null {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isInteger(n) ? n : NaN;
}

export async function updatePlan(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireRole(CONFIG_ROLES);
  const planId = String(formData.get("planId") || "");
  const name = String(formData.get("name") || "").trim();
  const featuresRaw = String(formData.get("features") || "").trim();
  const trialDaysRaw = String(formData.get("trialDays") || "").trim();

  const maxGarages = parseOptionalInt(formData.get("maxGarages"));
  const maxVehicles = parseOptionalInt(formData.get("maxVehicles"));
  const maxSeats = parseOptionalInt(formData.get("maxSeats"));
  const maxJobsPerMonth = parseOptionalInt(formData.get("maxJobsPerMonth"));
  const maxStaff = parseOptionalInt(formData.get("maxStaff"));

  if (!name) return { error: "Plan name is required." };
  for (const [label, v] of [
    ["Garage limit", maxGarages],
    ["Vehicle limit", maxVehicles],
    ["Seat limit", maxSeats],
    ["Jobs/month limit", maxJobsPerMonth],
    ["Staff limit", maxStaff],
  ] as const) {
    if (Number.isNaN(v)) return { error: `${label} must be a whole number, or left blank for unlimited.` };
  }

  let trialDays: number | null = null;
  if (trialDaysRaw) {
    trialDays = Number(trialDaysRaw);
    if (!Number.isInteger(trialDays) || trialDays < 0) {
      return { error: "Trial days must be a non-negative whole number, or left blank." };
    }
  }

  const features = featuresRaw
    ? featuresRaw.split(",").map((f) => f.trim()).filter(Boolean)
    : [];

  const before = await prisma.plan.findUnique({ where: { id: planId } });
  if (!before) return { error: "Plan not found." };

  const after = await prisma.plan.update({
    where: { id: planId },
    data: { name, features, trialDays, maxGarages, maxVehicles, maxSeats, maxJobsPerMonth, maxStaff },
  });

  await writeAdminAuditLog(admin, {
    action: "config.plan_update",
    entityType: "Plan",
    entityId: planId,
    beforeData: {
      name: before.name,
      features: before.features,
      trialDays: before.trialDays,
      maxGarages: before.maxGarages,
      maxVehicles: before.maxVehicles,
      maxSeats: before.maxSeats,
      maxJobsPerMonth: before.maxJobsPerMonth,
      maxStaff: before.maxStaff,
    },
    afterData: {
      name: after.name,
      features: after.features,
      trialDays: after.trialDays,
      maxGarages: after.maxGarages,
      maxVehicles: after.maxVehicles,
      maxSeats: after.maxSeats,
      maxJobsPerMonth: after.maxJobsPerMonth,
      maxStaff: after.maxStaff,
    },
  });

  revalidatePath(`/config/plans/${planId}`);
  revalidatePath("/config/plans");
  return { ok: true, message: "Plan updated." };
}

export async function upsertPlanPrice(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireRole(CONFIG_ROLES);
  const planId = String(formData.get("planId") || "");
  const currency = String(formData.get("currency") || "").trim().toUpperCase();
  const priceCentsRaw = String(formData.get("priceCents") || "").trim();

  if (!currency) return { error: "Currency is required." };
  const priceCents = Number(priceCentsRaw);
  if (!Number.isInteger(priceCents) || priceCents < 0) return { error: "Price (in cents) must be a non-negative whole number." };

  const before = await prisma.planPrice.findUnique({ where: { planId_currency: { planId, currency } } });

  const price = await prisma.planPrice.upsert({
    where: { planId_currency: { planId, currency } },
    create: { planId, currency, priceCents, updatedByAdminId: admin.adminId },
    update: { priceCents, updatedByAdminId: admin.adminId },
  });

  await writeAdminAuditLog(admin, {
    action: "config.plan_price_upsert",
    entityType: "PlanPrice",
    entityId: price.id,
    beforeData: before ? { priceCents: before.priceCents } : null,
    afterData: { planId, currency, priceCents },
    metadata: {
      note:
        "This changes the price new signups/migrations see for this plan+currency. Existing subscriptions with " +
        "Subscription.lockedPriceCents/lockedCurrency set keep their agreed price and are unaffected unless " +
        "explicitly migrated — see CFG-02's page banner. Money's MRR report (src/lib/money/mrr.ts) still reads " +
        "the live Plan.priceCents, not lockedPriceCents, for every subscription — a pre-existing limitation, not " +
        "something this edit changes.",
    },
  });

  revalidatePath(`/config/plans/${planId}`);
  return { ok: true, message: "Price saved." };
}

export async function deletePlanPrice(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireRole(CONFIG_ROLES);
  const priceId = String(formData.get("priceId") || "");
  const price = await prisma.planPrice.findUnique({ where: { id: priceId } });
  if (!price) return { error: "Price not found." };

  await prisma.planPrice.delete({ where: { id: priceId } });

  await writeAdminAuditLog(admin, {
    action: "config.plan_price_delete",
    entityType: "PlanPrice",
    entityId: priceId,
    beforeData: { planId: price.planId, currency: price.currency, priceCents: price.priceCents },
  });

  revalidatePath(`/config/plans/${price.planId}`);
  return { ok: true, message: "Price removed." };
}
