import type { NextRequest } from "next/server";
import { requireAccount } from "@/lib/api/auth";
import { apiError, apiOk } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/errors";
import { StoreBillingNotConfiguredError, syncStoreSubscriptions } from "@/lib/billing/store";

// POST /api/v1/billing/sync — the app calls this right after a purchase or a
// restore. The server reads what the account bought from the store (via
// RevenueCat) itself; nothing the app sends is trusted.
// Chain: auth -> account -> sync from the store.
export async function POST(req: NextRequest) {
  try {
    const account = await requireAccount(req);
    await syncStoreSubscriptions(account.id);
    return apiOk({ synced: true });
  } catch (error) {
    if (error instanceof StoreBillingNotConfiguredError) return apiError(503, "NOT_CONFIGURED", error.message);
    return handleApiError(error);
  }
}
