import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAccount } from "@/lib/api/auth";
import { requireVehicleAccess } from "@/lib/api/authorize";
import { apiOk } from "@/lib/api/response";
import { handleApiError, NotFoundError } from "@/lib/api/errors";
import { writeAuditLog } from "@/lib/audit";

// POST /api/v1/reminders/:id/resolve — idempotent.
// Chain: auth -> account -> resolve reminder -> membership/ownership -> update -> audit log.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const account = await requireAccount(req);
    const { id } = await params;

    const reminder = await prisma.reminder.findUnique({ where: { id } });
    if (!reminder) {
      throw new NotFoundError("Reminder not found.");
    }
    await requireVehicleAccess(account.id, reminder.vehicleId);

    const updated = await prisma.reminder.update({
      where: { id },
      data: { resolved: true },
    });

    await writeAuditLog({
      actorId: account.id,
      action: "reminder.resolve",
      entityType: "Reminder",
      entityId: id,
    });

    return apiOk(updated);
  } catch (error) {
    return handleApiError(error);
  }
}
