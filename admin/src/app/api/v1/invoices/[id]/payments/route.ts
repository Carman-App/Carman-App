import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAccount } from "@/lib/api/auth";
import { requireWorkshopRole } from "@/lib/api/authorize";
import { apiError, apiOk } from "@/lib/api/response";
import { handleApiError, ConflictError, NotFoundError } from "@/lib/api/errors";
import { recordPaymentSchema } from "@/lib/api/schemas";
import { writeAuditLog } from "@/lib/audit";
import { InvoiceStatus, JobStatus, WorkshopRole, type PaymentMethod } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";
import { canTransitionJob } from "@/lib/jobs/state-machine";

// POST /api/v1/invoices/:id/payments — record a payment against an invoice.
//
// Product spec: "Invoices and payments: the approved work billed, PART
// PAYMENTS recorded, the method noted, the balance carried." This is the
// only write path onto Payment — the Prisma schema already models multiple
// payments per invoice and an InvoiceStatus.PARTIALLY_PAID state, but until
// this route nothing ever created a Payment row, so partial payment was
// structurally possible but practically unreachable. The remaining balance
// is always computed from the sum of real payment rows, never a
// separately-maintained counter that could drift.
//
// Chain: auth -> account -> resolve invoice -> workshop role (owner/
// mechanic/front desk — not apprentice, this is a money action) -> validate
// -> balance check -> create payment + advance invoice/job status together
// -> audit log.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const account = await requireAccount(req);
    const { id: invoiceId } = await params;

    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { payments: { where: { deletedAt: null } }, job: true },
    });
    if (!invoice || invoice.deletedAt) {
      throw new NotFoundError("Invoice not found.");
    }

    await requireWorkshopRole(account.id, invoice.workshopId, [
      WorkshopRole.OWNER,
      WorkshopRole.MECHANIC,
      WorkshopRole.FRONTDESK,
    ]);

    const body = await req.json().catch(() => null);
    const parsed = recordPaymentSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(422, "VALIDATION_ERROR", "Invalid payment payload.", parsed.error.flatten());
    }

    if (invoice.status === InvoiceStatus.PAID) {
      throw new ConflictError("This invoice is already fully paid.");
    }

    const paidSoFar = invoice.payments.reduce((sum, p) => sum + Number(p.amount), 0);
    const total = Number(invoice.total);
    const remaining = Math.round((total - paidSoFar) * 100) / 100;
    if (parsed.data.amount > remaining + 0.005) {
      return apiError(
        422,
        "VALIDATION_ERROR",
        `Payment of ${parsed.data.amount} exceeds the remaining balance of ${remaining.toFixed(2)}.`,
      );
    }

    const newPaidTotal = Math.round((paidSoFar + parsed.data.amount) * 100) / 100;
    const nextInvoiceStatus =
      newPaidTotal >= total ? InvoiceStatus.PAID : InvoiceStatus.PARTIALLY_PAID;
    const nextJobStatus = nextInvoiceStatus === InvoiceStatus.PAID ? JobStatus.PAID : JobStatus.PARTIALLY_PAID;

    const ops: Prisma.PrismaPromise<unknown>[] = [
      prisma.payment.create({
        data: {
          invoiceId,
          amount: parsed.data.amount,
          method: parsed.data.method as PaymentMethod | undefined,
          recordedByAccountId: account.id,
          notes: parsed.data.notes,
        },
      }),
      prisma.invoice.update({
        where: { id: invoiceId },
        data: { status: nextInvoiceStatus },
      }),
    ];

    // Mirror the invoice's paid state onto the job (JobStatus carries the
    // same PARTIALLY_PAID/PAID values) — only ever advance along the state
    // machine's existing edges, never invent a transition it doesn't allow
    // (e.g. a job an operator moved around out of band).
    if (canTransitionJob(invoice.job.status, nextJobStatus)) {
      ops.push(
        prisma.job.update({ where: { id: invoice.job.id }, data: { status: nextJobStatus } }),
        prisma.jobStatusEvent.create({
          data: {
            jobId: invoice.job.id,
            fromStatus: invoice.job.status,
            toStatus: nextJobStatus,
            changedByAccountId: account.id,
          },
        }),
      );
    }

    const results = await prisma.$transaction(ops);
    const payment = results[0] as Awaited<ReturnType<typeof prisma.payment.create>>;

    await writeAuditLog({
      actorId: account.id,
      action: "invoice.payment.record",
      entityType: "Payment",
      entityId: payment.id,
      metadata: { invoiceId, amount: parsed.data.amount, method: parsed.data.method },
    });

    return apiOk(payment, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
