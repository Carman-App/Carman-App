import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAccount } from "@/lib/api/auth";
import { requireVehicleAccess } from "@/lib/api/authorize";
import { apiOk } from "@/lib/api/response";
import { handleApiError, NotFoundError } from "@/lib/api/errors";

// GET /api/v1/invoices/:id — owner-side read/pay view.
// Chain: auth -> account -> resolve invoice -> membership/ownership -> resource.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const account = await requireAccount(req);
    const { id } = await params;

    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        items: true,
        payments: { where: { deletedAt: null }, orderBy: { paidAt: "desc" } },
        workshop: { select: { id: true, name: true } },
        estimate: true,
      },
    });
    if (!invoice || invoice.deletedAt) {
      throw new NotFoundError("Invoice not found.");
    }
    await requireVehicleAccess(account.id, invoice.vehicleId);

    return apiOk(invoice);
  } catch (error) {
    return handleApiError(error);
  }
}
