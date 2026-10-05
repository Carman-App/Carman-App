import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAccount } from "@/lib/api/auth";
import { apiError, apiOk } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/errors";
import { consentSchema } from "@/lib/api/schemas";
import { deviceFromHeaders } from "@/lib/activity";
import { TERMS_VERSION } from "@/lib/legal";

// GET /api/v1/account/consents — the caller's latest answer per purpose, and
// whether they have accepted the current Terms version.
export async function GET(req: NextRequest) {
  try {
    const account = await requireAccount(req);
    const rows = await prisma.privacyConsent.findMany({ where: { accountId: account.id }, orderBy: { capturedAt: "desc" } });
    const latest: Record<string, { granted: boolean; termsVersion: string; capturedAt: Date }> = {};
    for (const r of rows) if (!latest[r.purpose]) latest[r.purpose] = { granted: r.granted, termsVersion: r.termsVersion, capturedAt: r.capturedAt };
    return apiOk({ termsVersion: TERMS_VERSION, accepted: latest.essential?.granted === true && latest.essential.termsVersion === TERMS_VERSION, purposes: latest });
  } catch (error) {
    return handleApiError(error);
  }
}

// POST /api/v1/account/consents — records what the person agreed to (one row
// per purpose, append-only, so the history of consent is kept: PRIV-01).
export async function POST(req: NextRequest) {
  try {
    const account = await requireAccount(req);
    const parsed = consentSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return apiError(422, "VALIDATION_ERROR", "Invalid consent.", parsed.error.flatten());
    const { termsVersion, source, purposes } = parsed.data;
    const entries = Object.entries(purposes);
    if (entries.length === 0) return apiError(422, "VALIDATION_ERROR", "Name at least one purpose.");

    const device = deviceFromHeaders(req.headers);
    await prisma.privacyConsent.createMany({
      data: entries.map(([purpose, granted]) => ({
        accountId: account.id,
        purpose,
        granted: !!granted,
        termsVersion,
        source,
        metadata: device ? { device } : undefined,
      })),
    });
    return apiOk({ recorded: entries.length }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
