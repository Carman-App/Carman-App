import "server-only";
import { prisma } from "@/lib/prisma";
import { REPORTING_CURRENCY } from "./currency";

/**
 * MON-09 — "revenue by country/currency with conversion basis stated (local
 * currency as charged, converted to one reporting currency, rate source+date
 * printed beside the figure)".
 *
 * FxRate starts empty (no live FX provider connected — see .env.example's
 * reserved STRIPE_* vars for the same "no processor" situation). Per
 * AGENTS.md's brief for this work, seeding a handful of static, honestly
 * labelled approximate rates here is reference data, not fabricated
 * transaction data, so it's fine to do — unlike inventing fake charges.
 * `source` names exactly that on every row so nobody mistakes it for a live
 * feed. This is idempotent (upsert) and safe to call on every page load,
 * mirroring the SubscriptionEvent backfill in ./events.ts.
 */

// Approximate reference rates (1 unit of currency -> REPORTING_CURRENCY/USD).
// Manually entered, not sourced from a live provider — see `source` below.
// If these are ever revisited, bump FX_AS_OF_DATE alongside the numbers.
const FX_AS_OF_DATE = new Date("2026-06-01T00:00:00.000Z");
const FX_SOURCE = "manually entered — no live FX provider connected (see .env.example)";

const STATIC_RATES: Record<string, number> = {
  USD: 1,
  KES: 1 / 130, // ~130 KES per USD
  UGX: 1 / 3700, // ~3,700 UGX per USD
  TZS: 1 / 2600, // ~2,600 TZS per USD
  NGN: 1 / 1630, // ~1,630 NGN per USD
  ZAR: 1 / 18.2, // ~18.2 ZAR per USD
  GBP: 1.27, // 1 GBP ~= 1.27 USD
};

export async function ensureFxRatesSeeded(): Promise<void> {
  await Promise.all(
    Object.entries(STATIC_RATES).map(([currency, rate]) =>
      prisma.fxRate.upsert({
        where: { currency },
        create: {
          currency,
          rateToReportingCurrency: rate,
          source: FX_SOURCE,
          asOfDate: FX_AS_OF_DATE,
        },
        // Only fill in if missing; don't clobber a rate an admin may have
        // hand-corrected via direct DB access.
        update: {},
      }),
    ),
  );
}

export type FxRateRow = {
  currency: string;
  rateToReportingCurrency: number;
  source: string;
  asOfDate: Date;
};

export async function getFxRateMap(): Promise<Map<string, FxRateRow>> {
  const rows = await prisma.fxRate.findMany();
  return new Map(
    rows.map((r) => [
      r.currency,
      {
        currency: r.currency,
        rateToReportingCurrency: r.rateToReportingCurrency.toNumber(),
        source: r.source,
        asOfDate: r.asOfDate,
      },
    ]),
  );
}

/** Returns null (rather than guessing) when no rate is on file for `currency`. */
export function convertCentsToReportingCurrency(
  cents: number,
  currency: string,
  rates: Map<string, FxRateRow>,
): number | null {
  if (currency === REPORTING_CURRENCY) return cents;
  const rate = rates.get(currency);
  if (!rate) return null;
  return Math.round(cents * rate.rateToReportingCurrency);
}
