import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAccount } from "@/lib/api/auth";
import { apiError, apiOk } from "@/lib/api/response";
import { handleApiError, NotFoundError } from "@/lib/api/errors";
import { updateAccountSchema } from "@/lib/api/schemas";
import { writeAuditLog } from "@/lib/audit";
import { PlanSubject, type ProfileType, type Region } from "@/generated/prisma/enums";
import { getPlanState } from "@/lib/limits";

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

    // The owner-side plan in force (starts the no-card trial on first read).
    const ps = await getPlanState(PlanSubject.OWNER, account.id);
    const plan = ps
      ? {
          code: ps.plan.code,
          name: ps.plan.name,
          state: ps.state,
          trialEndsAt: ps.trialEndsAt,
          limits: { garages: ps.plan.maxGarages, vehicles: ps.plan.maxVehicles, seats: ps.plan.maxSeats },
        }
      : null;

    return apiOk({ ...full, plan });
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
      if (input.region) {
        await tx.account.update({ where: { id: account.id }, data: { region: input.region as Region } });
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
