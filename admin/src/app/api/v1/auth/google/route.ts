import type { NextRequest } from "next/server";
import { apiError, apiOk } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/errors";
import { googleSignInSchema } from "@/lib/api/schemas";
import { signIn, verifyGoogleIdToken } from "@/lib/auth/end-user";
import { clientIp, enforceLimit, LIMITS } from "@/lib/rate-limit";
import { writeAuditLog } from "@/lib/audit";

// POST /api/v1/auth/google — exchange a Google ID token for a Carma session.
export async function POST(req: NextRequest) {
  try {
    await enforceLimit(LIMITS.auth, clientIp(req));
    const parsed = googleSignInSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return apiError(422, "VALIDATION_ERROR", "Invalid sign-in payload.");

    const identity = await verifyGoogleIdToken(parsed.data.idToken);
    const session = await signIn(identity, { userAgent: req.headers.get("user-agent") });

    await writeAuditLog({
      actorId: session.accountId,
      action: session.isNew ? "auth.sign_up" : "auth.sign_in",
      entityType: "Account",
      entityId: session.accountId,
      ipAddress: clientIp(req),
      metadata: { provider: "google" },
    });
    return apiOk(session);
  } catch (error) {
    return handleApiError(error);
  }
}
