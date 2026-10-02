import { prismaRead as prisma } from "@/lib/prisma";
import { InvoiceStatus } from "@/generated/prisma/enums";

// WORK-06 — this is mechanic-side money: what workshops invoice their own
// customers and collect on the platform. It has nothing to do with Carma's
// own subscription revenue (that's the Money/Billing surface, a different
// owner's screen) — never call anything here "MRR" or "Carma revenue".

export const OVERDUE_AGE_BUCKETS = ["0-30", "31-60", "61-90", "90+"] as const;
export type OverdueAgeBucket = (typeof OVERDUE_AGE_BUCKETS)[number];

export type MechanicMoneyTotals = {
  invoicedTotal: number;
  paidTotal: number;
  outstandingTotal: number;
  overdueTotal: number;
  overdueByBucket: Record<OverdueAgeBucket, number>;
  invoiceCount: number;
  overdueInvoiceCount: number;
};

function bucketForDaysPastDue(daysPastDue: number): OverdueAgeBucket {
  if (daysPastDue <= 30) return "0-30";
  if (daysPastDue <= 60) return "31-60";
  if (daysPastDue <= 90) return "61-90";
  return "90+";
}

/** Platform-wide invoiced/paid/outstanding/overdue totals with ageing buckets, for WORK-06. */
export async function getMechanicMoneyTotals(): Promise<MechanicMoneyTotals> {
  const invoices = await prisma.invoice.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      total: true,
      status: true,
      dueDate: true,
      payments: { where: { deletedAt: null }, select: { amount: true } },
    },
  });

  const now = Date.now();
  let invoicedTotal = 0;
  let paidTotal = 0;
  let overdueTotal = 0;
  let overdueInvoiceCount = 0;
  const overdueByBucket: Record<OverdueAgeBucket, number> = {
    "0-30": 0,
    "31-60": 0,
    "61-90": 0,
    "90+": 0,
  };

  for (const invoice of invoices) {
    const total = invoice.total.toNumber();
    const paid = invoice.payments.reduce((sum, p) => sum + p.amount.toNumber(), 0);
    const outstanding = Math.max(0, total - paid);

    invoicedTotal += total;
    paidTotal += paid;

    const isOverdue =
      invoice.status !== InvoiceStatus.PAID && invoice.dueDate != null && invoice.dueDate.getTime() < now && outstanding > 0;

    if (isOverdue) {
      overdueInvoiceCount += 1;
      overdueTotal += outstanding;
      const daysPastDue = (now - invoice.dueDate!.getTime()) / (1000 * 60 * 60 * 24);
      overdueByBucket[bucketForDaysPastDue(daysPastDue)] += outstanding;
    }
  }

  return {
    invoicedTotal,
    paidTotal,
    outstandingTotal: Math.max(0, invoicedTotal - paidTotal),
    overdueTotal,
    overdueByBucket,
    invoiceCount: invoices.length,
    overdueInvoiceCount,
  };
}

export type WorkshopBalanceWarning = {
  overdueInvoiceCount: number;
  overdueTotal: number;
};

/**
 * WORK-04's "the workshop's own balance warning as its owner sees it" — the
 * same overdue-unpaid-invoices signal the owner app would compute for a
 * single workshop, not an admin-only metric.
 */
export async function getWorkshopBalanceWarning(workshopId: string): Promise<WorkshopBalanceWarning> {
  const invoices = await prisma.invoice.findMany({
    where: { workshopId, deletedAt: null, status: { not: InvoiceStatus.PAID }, dueDate: { lt: new Date() } },
    select: {
      total: true,
      payments: { where: { deletedAt: null }, select: { amount: true } },
    },
  });

  let overdueTotal = 0;
  let overdueInvoiceCount = 0;
  for (const invoice of invoices) {
    const total = invoice.total.toNumber();
    const paid = invoice.payments.reduce((sum, p) => sum + p.amount.toNumber(), 0);
    const outstanding = Math.max(0, total - paid);
    if (outstanding > 0) {
      overdueInvoiceCount += 1;
      overdueTotal += outstanding;
    }
  }

  return { overdueInvoiceCount, overdueTotal };
}
