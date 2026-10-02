import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAccount } from "@/lib/api/auth";
import { requireWorkshopRole } from "@/lib/api/authorize";
import { apiError, apiOk } from "@/lib/api/response";
import { handleApiError, ConflictError, NotFoundError } from "@/lib/api/errors";
import { inviteWorkshopCustomerSchema } from "@/lib/api/schemas";
import { writeAuditLog } from "@/lib/audit";
import { notify } from "@/lib/notifications/provider";
import { NotificationType, WorkshopRole } from "@/generated/prisma/enums";

// POST /api/v1/workshops/:id/customers/:customerId/invite — convert a
// walk-in "customer on file" into a linked Carma account.
//
// Product spec: "Customer on file: a walk-in the workshop has served...
// INVITABLE to Carma (i.e. a real conversion path from 'customer record' to
// 'linked Carma account')". Before this route, WorkshopCustomer.linkedAccountId
// could only be set by a workshop directly naming an accountId at
// customer-creation time — an unverified claim, not a real invite/consent
// flow (see createWorkshopCustomerSchema, which no longer accepts it for
// exactly this reason). This route is the real path: look the customer's
// email up against an existing Carma User, link only on a genuine match, and
// notify that account. If there's no match yet, the invite intent is still
// recorded honestly (this codebase's existing "no provider, but be honest
// about it" pattern — see src/lib/notifications/provider.ts) rather than
// silently doing nothing.
//
// Chain: auth -> account -> workshop role (owner/front desk — front desk
// "chases approvals", owner runs the account) -> resolve customer -> already
// linked? -> validate -> look up by email -> link + notify, or record intent.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; customerId: string }> },
) {
  try {
    const account = await requireAccount(req);
    const { id: workshopId, customerId } = await params;

    await requireWorkshopRole(account.id, workshopId, [
      WorkshopRole.OWNER,
      WorkshopRole.FRONTDESK,
    ]);

    const customer = await prisma.workshopCustomer.findUnique({ where: { id: customerId } });
    if (!customer || customer.workshopId !== workshopId) {
      throw new NotFoundError("Customer not found for this workshop.");
    }
    if (customer.linkedAccountId) {
      throw new ConflictError("This customer is already linked to a Carma account.");
    }

    const body = await req.json().catch(() => null);
    const parsed = inviteWorkshopCustomerSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(422, "VALIDATION_ERROR", "Invalid invite payload.", parsed.error.flatten());
    }

    const matchedUser = await prisma.user.findUnique({
      where: { email: parsed.data.email },
      include: { account: true },
    });

    const updated = await prisma.workshopCustomer.update({
      where: { id: customerId },
      data: {
        email: parsed.data.email,
        invitedAt: new Date(),
        invitedByAccountId: account.id,
        linkedAccountId: matchedUser?.account ? matchedUser.account.id : undefined,
      },
    });

    if (matchedUser?.account) {
      await notify({
        accountId: matchedUser.account.id,
        type: NotificationType.GENERIC,
        title: "A workshop wants to link your service history",
        body: "A workshop has invited you to link your Carma account so their completed work for you can appear in your vehicle's history.",
        metadata: { workshopId, workshopCustomerId: customerId },
      });
    }

    await writeAuditLog({
      actorId: account.id,
      action: "workshop.customer.invite",
      entityType: "WorkshopCustomer",
      entityId: customerId,
      targetAccountId: matchedUser?.account?.id ?? null,
      metadata: { matched: Boolean(matchedUser?.account) },
    });

    return apiOk({
      customer: updated,
      matched: Boolean(matchedUser?.account),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
