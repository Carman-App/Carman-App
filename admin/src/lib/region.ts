import { Region } from "@/generated/prisma/enums";

// No currency field exists anywhere in this schema (see AGENTS.md's Accounts
// brief, ACCT-10) — Account only stores `region`. This is the one place that
// derives a display currency from region, so it isn't reinvented per call
// site. It is a *display* mapping only: nothing in the schema stamps a
// currency on individual Decimal amounts (FuelRecord.amount, Invoice.total,
// etc.), so changing an account's region changes what currency new
// aggregates/displays assume going forward — it never re-labels or converts
// a historical amount, because those were never tagged with a currency to
// begin with.
export const REGION_CURRENCY: Record<Region, string> = {
  KE: "KES",
  UG: "UGX",
  TZ: "TZS",
  NG: "NGN",
  ZA: "ZAR",
  US: "USD",
  GB: "GBP",
};

export function currencyForRegion(region: Region): string {
  return REGION_CURRENCY[region] ?? "KES";
}

export const REGION_LABELS: Record<Region, string> = {
  KE: "Kenya",
  UG: "Uganda",
  TZ: "Tanzania",
  NG: "Nigeria",
  ZA: "South Africa",
  US: "United States",
  GB: "United Kingdom",
};
