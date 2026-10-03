import type { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAccount } from "@/lib/api/auth";
import { apiError, apiOk } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/errors";

// Expo push tokens look like ExponentPushToken[xxxx] (or ExpoPushToken[xxxx]).
const tokenSchema = z.string().trim().regex(/^Expo(nent)?PushToken\[[A-Za-z0-9_-]+\]$/, "Not an Expo push token.");

// POST /api/v1/push-tokens { token, platform } — this phone receives push
// notifications for the signed-in account. A token moves to whoever signed
// in last on that phone.
// Chain: auth -> account -> validate -> upsert.
export async function POST(req: NextRequest) {
  try {
    const account = await requireAccount(req);
    const parsed = z
      .object({ token: tokenSchema, platform: z.enum(["ios", "android"]) })
      .safeParse(await req.json().catch(() => null));
    if (!parsed.success) return apiError(422, "VALIDATION_ERROR", "Invalid push token.", parsed.error.flatten());
    const { token, platform } = parsed.data;

    await prisma.pushToken.upsert({
      where: { token },
      update: { accountId: account.id, platform, lastSeenAt: new Date() },
      create: { token, platform, accountId: account.id },
    });
    return apiOk({ registered: true });
  } catch (error) {
    return handleApiError(error);
  }
}

// DELETE /api/v1/push-tokens { token } — stop pushing to this phone (sign-out).
// Chain: auth -> account -> delete own token only.
export async function DELETE(req: NextRequest) {
  try {
    const account = await requireAccount(req);
    const parsed = z.object({ token: tokenSchema }).safeParse(await req.json().catch(() => null));
    if (!parsed.success) return apiError(422, "VALIDATION_ERROR", "Invalid push token.", parsed.error.flatten());
    await prisma.pushToken.deleteMany({ where: { token: parsed.data.token, accountId: account.id } });
    return apiOk({ registered: false });
  } catch (error) {
    return handleApiError(error);
  }
}
