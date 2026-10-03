import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError, apiOk } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/errors";
import { enqueue } from "@/lib/jobs/queue";

// POST /api/v1/billing/revenuecat — RevenueCat's webhook (renewals,
// cancellations, billing problems, refunds, transfers). Authenticated by the
// Authorization header set in RevenueCat → Integrations → Webhooks, which
// must equal REVENUECAT_WEBHOOK_AUTH. The event body only says *who* to look
// at: the sync job re-reads that account's purchases from RevenueCat.
// Chain: shared-secret check -> collect account ids -> enqueue sync.

function authorized(header: string | null): boolean {
  const expected = process.env.REVENUECAT_WEBHOOK_AUTH;
  if (!expected || !header) return false;
  const a = Buffer.from(header.replace(/^Bearer\s+/i, ""));
  const b = Buffer.from(expected.replace(/^Bearer\s+/i, ""));
  return a.length === b.length && timingSafeEqual(a, b);
}

type RcEvent = {
  type?: string;
  app_user_id?: string;
  original_app_user_id?: string;
  aliases?: string[];
  transferred_from?: string[];
  transferred_to?: string[];
};

export async function POST(req: NextRequest) {
  try {
    if (!process.env.REVENUECAT_WEBHOOK_AUTH) return apiError(503, "NOT_CONFIGURED", "REVENUECAT_WEBHOOK_AUTH is not set.");
    if (!authorized(req.headers.get("authorization"))) return apiError(401, "UNAUTHORIZED", "Bad webhook authorization.");

    const body = (await req.json().catch(() => null)) as { event?: RcEvent } | null;
    const event = body?.event;
    if (!event) return apiError(422, "VALIDATION_ERROR", "Missing event.");
    if (event.type === "TEST") return apiOk({ received: true });

    // Anonymous RevenueCat ids ($RCAnonymousID:…) are never Carma accounts.
    const ids = [
      ...new Set(
        [event.app_user_id, event.original_app_user_id, ...(event.aliases ?? []), ...(event.transferred_from ?? []), ...(event.transferred_to ?? [])].filter(
          (id): id is string => typeof id === "string" && id.length > 0 && !id.startsWith("$RCAnonymousID"),
        ),
      ),
    ].slice(0, 20);
    const accounts = ids.length ? await prisma.account.findMany({ where: { id: { in: ids } }, select: { id: true } }) : [];
    for (const a of accounts) await enqueue("billing.sync", { accountId: a.id });

    return apiOk({ received: true, accounts: accounts.length });
  } catch (error) {
    return handleApiError(error);
  }
}
