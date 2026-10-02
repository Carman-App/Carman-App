import type { NextRequest } from "next/server";
import { apiOk } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/errors";
import { refreshTokenSchema } from "@/lib/api/schemas";
import { signOut } from "@/lib/auth/end-user";
import { clientIp, enforceLimit, LIMITS } from "@/lib/rate-limit";

// POST /api/v1/auth/logout — end this device's session chain. Always succeeds.
export async function POST(req: NextRequest) {
  try {
    await enforceLimit(LIMITS.auth, clientIp(req));
    const parsed = refreshTokenSchema.safeParse(await req.json().catch(() => null));
    if (parsed.success) await signOut(parsed.data.refreshToken);
    return apiOk({ signedOut: true });
  } catch (error) {
    return handleApiError(error);
  }
}
