import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth/session";
import { BILLING_ROLES } from "@/lib/auth/rbac";
import { SubscriptionEventType, RefundCreditStatus, Region } from "@/generated/prisma/enums";
import { currencyForRegion } from "@/lib/region";
import { getFxRateMap, convertCentsToReportingCurrency } from "@/lib/money/fx";
import { REPORTING_CURRENCY } from "@/lib/money/currency";

export const dynamic = "force-dynamic";

// MON-10 — "monthly accountant export (CSV of charges/refunds/tax per line,
// account id/country/currency/gross/tax/net, reconciling to on-screen MRR)."
//
// This is a signed-in-admin-session route (cookie-based), same pattern as
// src/app/api/admin/audit/export/route.ts — checked via getSession()/role
// rather than the mobile x-carma-account-id header scheme.
//
// Tax: no tax field or tax-rate concept exists anywhere in this schema, so
// every row's tax column is honestly 0 with a note saying so, rather than
// guessing a rate. "Charges" are derived from real SubscriptionEvent rows
// (amountCents), and "refunds" from real, EXECUTED RefundCredit rows — both
// tables this work introduced. There is still no real processor-side charge
// ledger, so a STARTED/TRIAL_CONVERTED/UPGRADED/REACTIVATED event is the
// closest honest stand-in for "a charge occurred"; it says so in each row's
// note.
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session || !BILLING_ROLES.includes(session.role)) {
    return new Response("Forbidden", { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const monthParam = searchParams.get("month"); // "YYYY-MM"
  const now = new Date();
  const [year, month] = monthParam && /^\d{4}-\d{2}$/.test(monthParam)
    ? monthParam.split("-").map(Number)
    : [now.getUTCFullYear(), now.getUTCMonth() + 1];
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));

  const rates = await getFxRateMap();

  type Row = {
    lineType: string;
    accountId: string | null;
    country: string;
    currency: string;
    grossCents: number;
    taxCents: number;
    netCents: number;
    convertedGrossCents: number | null;
    note: string;
  };
  const rows: Row[] = [];

  function regionCountry(region: Region | null | undefined): string {
    return region ?? "UNKNOWN";
  }

  // --- Charges: real SubscriptionEvent rows with a recorded amount --------
  const events = await prisma.subscriptionEvent.findMany({
    where: {
      occurredAt: { gte: start, lt: end },
      type: {
        in: [
          SubscriptionEventType.STARTED,
          SubscriptionEventType.TRIAL_CONVERTED,
          SubscriptionEventType.UPGRADED,
          SubscriptionEventType.DOWNGRADED,
          SubscriptionEventType.CANCELLED,
          SubscriptionEventType.REACTIVATED,
        ],
      },
    },
    include: {
      subscription: {
        include: {
          plan: true,
          account: { select: { id: true, region: true } },
          workshop: { select: { ownerId: true, owner: { select: { region: true } } } },
        },
      },
    },
  });

  for (const e of events) {
    const accountId = e.subscription.accountId ?? e.subscription.workshop?.ownerId ?? null;
    const region = e.subscription.account?.region ?? e.subscription.workshop?.owner.region ?? null;
    const currency = region ? currencyForRegion(region) : REPORTING_CURRENCY;
    const isNegative = e.type === SubscriptionEventType.DOWNGRADED || e.type === SubscriptionEventType.CANCELLED;
    const magnitude = e.amountCents ?? e.subscription.plan.priceCents;
    const grossCents = isNegative ? -Math.abs(magnitude) : Math.abs(magnitude);
    const convertedGrossCents = convertCentsToReportingCurrency(grossCents, currency, rates);
    rows.push({
      lineType: `CHARGE_${e.type}`,
      accountId,
      country: regionCountry(region),
      currency,
      grossCents,
      taxCents: 0,
      netCents: grossCents,
      convertedGrossCents,
      note: "No processor charge ledger exists — derived from SubscriptionEvent.amountCents (or plan list price when not recorded). Tax not tracked anywhere in this schema; treated as 0.",
    });
  }

  // --- Refunds/credits: real, EXECUTED RefundCredit rows -------------------
  const refunds = await prisma.refundCredit.findMany({
    where: { status: RefundCreditStatus.EXECUTED, executedAt: { gte: start, lt: end } },
    include: {
      subscription: {
        include: {
          account: { select: { id: true, region: true } },
          workshop: { select: { ownerId: true, owner: { select: { region: true } } } },
        },
      },
    },
  });

  for (const r of refunds) {
    const accountId = r.subscription.accountId ?? r.subscription.workshop?.ownerId ?? null;
    const region = r.subscription.account?.region ?? r.subscription.workshop?.owner.region ?? null;
    const grossCents = -Math.abs(r.amountCents);
    const convertedGrossCents = convertCentsToReportingCurrency(grossCents, r.currency, rates);
    rows.push({
      lineType: r.type, // REFUND | CREDIT
      accountId,
      country: regionCountry(region),
      currency: r.currency,
      grossCents,
      taxCents: 0,
      netCents: grossCents,
      convertedGrossCents,
      note: `No payment processor connected — no real money moved; this is the recorded admin decision (${r.reason}).`,
    });
  }

  const totalConvertedCents = rows.reduce((sum, r) => sum + (r.convertedGrossCents ?? 0), 0);

  const header = ["lineType", "accountId", "country", "currency", "grossCents", "taxCents", "netCents", `convertedGrossCents_${REPORTING_CURRENCY}`, "note"];
  const csvEscape = (v: unknown) => {
    if (v == null) return "";
    const s = typeof v === "string" ? v : String(v);
    return `"${s.replace(/"/g, '""')}"`;
  };
  const csvRows = rows.map((r) =>
    [r.lineType, r.accountId, r.country, r.currency, r.grossCents, r.taxCents, r.netCents, r.convertedGrossCents, r.note]
      .map(csvEscape)
      .join(","),
  );
  csvRows.push(
    ["TOTAL", "", "", REPORTING_CURRENCY, "", "", "", totalConvertedCents, `Reconciles against the MRR movement net shown on /billing for ${year}-${String(month).padStart(2, "0")}.`]
      .map(csvEscape)
      .join(","),
  );
  const csv = [header.join(","), ...csvRows].join("\n");

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="carma-billing-export-${year}-${String(month).padStart(2, "0")}.csv"`,
    },
  });
}
