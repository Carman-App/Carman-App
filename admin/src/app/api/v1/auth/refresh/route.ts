import type { NextRequest } from "next/server";
import { apiError, apiOk } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/errors";
import { refreshTokenSchema } from "@/lib/api/schemas";
import { refreshSession } from "@/lib/auth/end-user";
import { clientIp, enforceLimit, LIMITS } from "@/lib/rate-limit";

// POST /api/v1/auth/refresh — trade a refresh token for a new access + refresh pair (rotation).
export async function POST(req: NextRequest) {
  try {
    await enforceLimit(LIMITS.auth, clientIp(req));
    const parsed = refreshTokenSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return apiError(422, "VALIDATION_ERROR", "Invalid refresh payload.");
    return apiOk(await refreshSession(parsed.data.refreshToken, req.headers.get("user-agent")));
  } catch (error) {
    return handleApiError(error);
  }
}
