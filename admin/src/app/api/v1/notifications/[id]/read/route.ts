import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAccount, ForbiddenError } from "@/lib/api/auth";
import { apiOk } from "@/lib/api/response";
import { handleApiError, NotFoundError } from "@/lib/api/errors";

// POST /api/v1/notifications/:id/read — idempotent.
// Chain: auth -> account -> resolve notification -> ownership -> update.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const account = await requireAccount(req);
    const { id } = await params;

    const notification = await prisma.notification.findUnique({ where: { id } });
    if (!notification) {
      throw new NotFoundError("Notification not found.");
    }
    if (notification.accountId !== account.id) {
      throw new ForbiddenError("This notification does not belong to you.");
    }

    const updated = notification.readAt
      ? notification
      : await prisma.notification.update({ where: { id }, data: { readAt: new Date() } });

    return apiOk(updated);
  } catch (error) {
    return handleApiError(error);
  }
}
