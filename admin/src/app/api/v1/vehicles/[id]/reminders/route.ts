import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAccount } from "@/lib/api/auth";
import { requireVehicleAccess } from "@/lib/api/authorize";
import { apiError, apiOk, apiOkPaginated } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/errors";
import { parsePagination } from "@/lib/api/pagination";
import { writeAuditLog } from "@/lib/audit";
import { ReminderKind } from "@/generated/prisma/enums";
import { z } from "zod";

// GET /api/v1/vehicles/:id/reminders — paginated. ?resolved=true to include
// resolved reminders too (default: unresolved only).
// Chain: auth -> account -> membership/ownership -> query.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const account = await requireAccount(req);
    const { id: vehicleId } = await params;

    await requireVehicleAccess(account.id, vehicleId);

    const { page, pageSize, skip, take } = parsePagination(req);
    const includeResolved = req.nextUrl.searchParams.get("resolved") === "true";
    const where = includeResolved ? { vehicleId } : { vehicleId, resolved: false };

    const [items, total] = await Promise.all([
      prisma.reminder.findMany({ where, orderBy: { createdAt: "desc" }, skip, take }),
      prisma.reminder.count({ where }),
    ]);

    return apiOkPaginated(items, { page, pageSize, total });
  } catch (error) {
    return handleApiError(error);
  }
}

const createReminderSchema = z
  .object({
    kind: z.enum([ReminderKind.SERVICE_DUE, ReminderKind.DOCUMENT_EXPIRY, ReminderKind.PAYMENT_DUE, ReminderKind.WARRANTY_END]),
    description: z.string().trim().min(1).max(200),
    dueDate: z.coerce.date().optional(),
    dueKm: z.number().int().positive().max(9_999_999).optional(),
    /** When to tell the owner. Defaults to dueDate. */
    remindAt: z.coerce.date().optional(),
    /** Recurring charges (instalment, subscription, tracker fee): months between notices. */
    repeatMonths: z.number().int().min(1).max(24).optional(),
  })
  .refine((v) => v.dueDate || v.dueKm, { message: "A reminder needs a date or a distance." });

// POST /api/v1/vehicles/:id/reminders — a reminder the owner switched on in a
// record form ("Remind me before it expires"). Due dates are worked out by the
// app from the dates on the form; the daily reminders.scan job sends the notice.
// Chain: auth -> account -> membership/ownership -> validate -> create -> audit log.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const account = await requireAccount(req);
    const { id: vehicleId } = await params;
    await requireVehicleAccess(account.id, vehicleId);

    const parsed = createReminderSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return apiError(422, "VALIDATION_ERROR", "Invalid reminder.", parsed.error.flatten());
    }
    const input = parsed.data;
    const reminder = await prisma.reminder.create({
      data: {
        vehicleId,
        kind: input.kind,
        description: input.description,
        dueDate: input.dueDate,
        dueKm: input.dueKm,
        remindAt: input.remindAt ?? input.dueDate,
        repeatMonths: input.repeatMonths,
        createdById: account.id,
      },
    });

    await writeAuditLog({
      actorId: account.id,
      action: "reminder.create",
      entityType: "Reminder",
      entityId: reminder.id,
    });

    return apiOk(reminder, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
