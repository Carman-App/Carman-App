import "server-only";
import { prismaRead as prisma } from "@/lib/prisma";
import { Region } from "@/generated/prisma/enums";
import { REGION_LABELS, currencyForRegion } from "@/lib/region";
import {
  getActivatedAccountIds,
  getFxRateMap,
  convertAmountToReportingCurrency,
  trailingWindow,
  type DateRange,
} from "./definitions";
import { getMrrSnapshot } from "@/lib/money/mrr";

// GROW-07 — GROW-01..06's numbers split by Account.region, with local
// currency (currencyForRegion) shown alongside the reporting-currency
// conversion for money figures (MRR, collection-rate revenue side), using
// Money's FX helper (definitions.ts's convertAmountToReportingCurrency,
// which itself delegates to money/fx.ts — no FX math re-derived here).
//
// Revenue (Invoice/Payment) has no currency column anywhere in the schema
// (see src/lib/region.ts's header note) — it is attributed to a region, and
// therefore a currency, via the *vehicle owner's* Account.region (the
// customer whose car the invoice/payment is for), mirroring how Money
// derives a Subscription's currency from the paying account's region
// (src/lib/money/currency.ts's currencyForSubscription).

export type GeographyRow = {
  region: Region;
  label: string;
  currency: string;
  accountCount: number;
  activeAccountCount: number; // trailing 30 days, Active-user definition
  activatedAccountCount: number;
  mrrGrossCents: number; // gross MRR in this region's local currency, from Money's own MRR snapshot (Int cents)
  mrrReportingCents: number | null; // Int cents, reporting currency
  invoicedLocal: number; // sum(Invoice.total) in the window, local currency, whole units (Decimal, not cents)
  invoicedReportingAmount: number | null; // whole units, reporting currency
  collectedLocal: number; // sum(Payment.amount) in the window, local currency, whole units (Decimal, not cents)
  collectedReportingAmount: number | null; // whole units, reporting currency
};

export async function getGeographyBreakdown(windowDays = 30): Promise<GeographyRow[]> {
  const range: DateRange = trailingWindow(windowDays);

  const [accounts, activatedIds, mrr, rates, invoices, payments] = await Promise.all([
    prisma.account.findMany({ where: { deletedAt: null }, select: { id: true, region: true, lastApiRequestAt: true } }),
    getActivatedAccountIds(),
    getMrrSnapshot(),
    getFxRateMap(),
    prisma.invoice.findMany({
      where: { createdAt: { gte: range.start, lt: range.end }, deletedAt: null },
      select: { total: true, vehicle: { select: { garage: { select: { owner: { select: { region: true } } } } } } },
    }),
    prisma.payment.findMany({
      where: { paidAt: { gte: range.start, lt: range.end }, deletedAt: null },
      select: {
        amount: true,
        invoice: { select: { vehicle: { select: { garage: { select: { owner: { select: { region: true } } } } } } } },
      },
    }),
  ]);

  const mrrByCurrency = new Map(mrr.mrrByCurrency.map((r) => [r.currency, r]));
  const invoicedByRegion = new Map<Region, number>();
  for (const inv of invoices) {
    const region = inv.vehicle.garage.owner.region;
    invoicedByRegion.set(region, (invoicedByRegion.get(region) ?? 0) + inv.total.toNumber());
  }
  const collectedByRegion = new Map<Region, number>();
  for (const pay of payments) {
    const region = pay.invoice.vehicle.garage.owner.region;
    collectedByRegion.set(region, (collectedByRegion.get(region) ?? 0) + pay.amount.toNumber());
  }

  return Object.values(Region).map((region) => {
    const currency = currencyForRegion(region);
    const regionAccounts = accounts.filter((a) => a.region === region);
    const activeAccountCount = regionAccounts.filter(
      (a) => a.lastApiRequestAt && a.lastApiRequestAt >= range.start && a.lastApiRequestAt < range.end,
    ).length;
    const activatedAccountCount = regionAccounts.filter((a) => activatedIds.has(a.id)).length;

    const mrrRow = mrrByCurrency.get(currency);
    const invoicedLocal = invoicedByRegion.get(region) ?? 0;
    const collectedLocal = collectedByRegion.get(region) ?? 0;

    return {
      region,
      label: REGION_LABELS[region],
      currency,
      accountCount: regionAccounts.length,
      activeAccountCount,
      activatedAccountCount,
      mrrGrossCents: mrrRow?.grossCents ?? 0,
      mrrReportingCents: mrrRow?.convertedCents ?? null,
      invoicedLocal,
      invoicedReportingAmount: convertAmountToReportingCurrency(invoicedLocal, currency, rates),
      collectedLocal,
      collectedReportingAmount: convertAmountToReportingCurrency(collectedLocal, currency, rates),
    };
  });
}
