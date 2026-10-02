import { apiOk } from "@/lib/api/response";
import { providerAudiences } from "@/lib/auth/end-user";
import { devAccountHeaderAllowed } from "@/lib/api/auth";
import { prisma } from "@/lib/prisma";
import { cached } from "@/lib/redis";
import { PLAN_CODES } from "@/lib/limits";

// GET /api/v1/auth/config — which sign-in methods this server accepts, so the
// app only shows buttons that will work. Public: holds no secrets.
export async function GET() {
  const a = providerAudiences();
  // The trial a new account gets (CFG-08), for the Welcome screen's "N DAYS FREE".
  const trialDays = await cached("auth:config:trialDays", 300, async () => {
    const [rules, trialPlan] = await Promise.all([
      prisma.subscriptionRules.findUnique({ where: { key: "global" }, select: { trialDays: true } }),
      prisma.plan.findUnique({ where: { code: PLAN_CODES.OWNER_PRO }, select: { trialDays: true } }),
    ]);
    return trialPlan?.trialDays ?? rules?.trialDays ?? 14;
  }).catch(() => null);
  return apiOk({ google: a.google.length > 0, apple: a.apple.length > 0, devAccount: devAccountHeaderAllowed(), trialDays });
}
