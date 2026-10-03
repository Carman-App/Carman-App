import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAccount } from "@/lib/api/auth";
import { apiError, apiOk } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/errors";
import { PlanSubject } from "@/generated/prisma/enums";
import { currencyForRegion } from "@/lib/region";

// GET /api/v1/plans?subject=OWNER|WORKSHOP — the plans a side of the product
// offers, with limits, features and the price in the caller's currency when
// one has been set (CFG-02). Price is null until set from the console.
// Chain: auth -> account -> query.
export async function GET(req: NextRequest) {
  try {
    const account = await requireAccount(req);
    const subject = (req.nextUrl.searchParams.get("subject") ?? "OWNER").toUpperCase();
    if (subject !== PlanSubject.OWNER && subject !== PlanSubject.WORKSHOP) {
      return apiError(422, "VALIDATION_ERROR", "subject must be OWNER or WORKSHOP.");
    }
    const currency = currencyForRegion(account.region);

    const plans = await prisma.plan.findMany({
      where: { subject },
      include: { prices: { where: { currency } } },
      orderBy: { createdAt: "asc" },
    });

    return apiOk(
      plans.map((p) => ({
        code: p.code,
        name: p.name,
        features: p.features,
        trialDays: p.trialDays,
        // In-app purchase products that buy this plan; the app shows the
        // store's own price for them. Empty = not sold in the app.
        storeProductIds: p.storeProductIds,
        limits: { garages: p.maxGarages, vehicles: p.maxVehicles, seats: p.maxSeats, jobsPerMonth: p.maxJobsPerMonth, staff: p.maxStaff },
        price: p.prices[0] ? { currency, amountCents: p.prices[0].priceCents } : null,
      })),
    );
  } catch (error) {
    return handleApiError(error);
  }
}
