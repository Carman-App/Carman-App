import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAccount } from "@/lib/api/auth";
import { apiError, apiOk } from "@/lib/api/response";
import { handleApiError, NotFoundError } from "@/lib/api/errors";
import { updateAccountSchema } from "@/lib/api/schemas";
import { writeAuditLog } from "@/lib/audit";
import { PlanSubject, type ProfileType, type Region } from "@/generated/prisma/enums";
import { getPlanState, type PlanState } from "@/lib/limits";
import { deleteOwnAccount } from "@/lib/accounts/self-delete";
import { clientIp } from "@/lib/rate-limit";

async function planPayload(ps: PlanState | null) {
  if (!ps) return null;
  // How the plan is paid, for "Renews on …" / "Ends on …" and Manage subscription.
  const sub =
    ps.state !== "free" && ps.subscriptionId
      ? await prisma.subscription.findUnique({ where: { id: ps.subscriptionId }, select: { store: true, storeProductId: true, willRenew: true, currentPeriodEnd: true } })
      : null;
  return {
    code: ps.plan.code,
    name: ps.plan.name,
    state: ps.state,
    trialEndsAt: ps.trialEndsAt,
    limits: { garages: ps.plan.maxGarages, vehicles: ps.plan.maxVehicles, seats: ps.plan.maxSeats, jobsPerMonth: ps.plan.maxJobsPerMonth, staff: ps.plan.maxStaff },
    store: sub?.store ?? null,
    storeProductId: sub?.storeProductId ?? null,
    willRenew: sub?.willRenew ?? null,
    currentPeriodEnd: sub?.currentPeriodEnd ?? null,
  };
}

// GET /api/v1/account — the caller's own Account, user, profiles and owner-side plan.
// Chain: auth -> account -> resource.
export async function GET(req: NextRequest) {
  try {
    const account = await requireAccount(req);

    const full = await prisma.account.findUnique({
      where: { id: account.id },
      include: { user: true, profiles: true },
    });
    if (!full) {
      throw new NotFoundError("Account not found.");
    }

    // The owner-side plan in force (starts the no-card trial on first read),
    // and the workshop's when the account runs one.
    const workshop = await prisma.workshop.findFirst({ where: { ownerId: account.id }, select: { id: true }, orderBy: { createdAt: "asc" } });
    const [plan, workshopPlan] = await Promise.all([
      planPayload(await getPlanState(PlanSubject.OWNER, account.id)),
      workshop ? getPlanState(PlanSubject.WORKSHOP, workshop.id).then(planPayload) : null,
    ]);

    return apiOk({ ...full, plan, workshopPlan });
  } catch (error) {
    return handleApiError(error);
  }
}

// PATCH /api/v1/account — update region, the underlying User's display name,
// and/or switch which AccountProfile (OWNER/MECHANIC) is active.
// Chain: auth -> account -> validate -> (profile exists, if switching) -> update -> audit log.
export async function PATCH(req: NextRequest) {
  try {
    const account = await requireAccount(req);

    const body = await req.json().catch(() => null);
    const parsed = updateAccountSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(422, "VALIDATION_ERROR", "Invalid account payload.", parsed.error.flatten());
    }
    const input = parsed.data;

    const activeProfileType = input.activeProfileType as ProfileType | undefined;

    if (activeProfileType) {
      const targetProfile = await prisma.accountProfile.findUnique({
        where: { accountId_type: { accountId: account.id, type: activeProfileType } },
      });
      if (!targetProfile) {
        return apiError(
          422,
          "VALIDATION_ERROR",
          `This account has no ${input.activeProfileType} profile to activate.`,
        );
      }
    }

    await prisma.$transaction(async (tx) => {
      if (input.region || input.notificationPrefs) {
        await tx.account.update({
          where: { id: account.id },
          data: {
            ...(input.region ? { region: input.region as Region } : {}),
            ...(input.notificationPrefs ? { notificationPrefs: input.notificationPrefs } : {}),
          },
        });
      }
      if (input.name) {
        await tx.user.update({ where: { id: account.userId }, data: { name: input.name } });
      }
      if (activeProfileType) {
        await tx.accountProfile.updateMany({
          where: { accountId: account.id },
          data: { isActive: false },
        });
        await tx.accountProfile.update({
          where: { accountId_type: { accountId: account.id, type: activeProfileType } },
          data: { isActive: true },
        });
      }
    });

    const updated = await prisma.account.findUnique({
      where: { id: account.id },
      include: { user: true, profiles: true },
    });

    await writeAuditLog({
      actorId: account.id,
      action: "account.update",
      entityType: "Account",
      entityId: account.id,
      metadata: input,
    });

    return apiOk(updated);
  } catch (error) {
    return handleApiError(error);
  }
}

// DELETE /api/v1/account — the signed-in person deletes their own account.
// Body: { "confirm": "DELETE" }. Ends every session at once; the data is
// purged after a grace window (see src/lib/accounts/self-delete.ts).
export async function DELETE(req: NextRequest) {
  try {
    const account = await requireAccount(req);
    const body = (await req.json().catch(() => null)) as { confirm?: string } | null;
    if (body?.confirm !== "DELETE") {
      return apiError(422, "CONFIRMATION_REQUIRED", 'Send { "confirm": "DELETE" } to delete this account.');
    }
    const { purgeAfter } = await deleteOwnAccount(account.id, clientIp(req));
    return apiOk({ deleted: true, purgeAfter });
  } catch (error) {
    return handleApiError(error);
  }
}
