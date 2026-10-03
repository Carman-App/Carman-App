import { prisma } from "@/lib/prisma";
import { apiError, apiOk } from "@/lib/api/response";
import { handleApiError } from "@/lib/api/errors";
import { devAccountHeaderAllowed } from "@/lib/api/auth";

// GET /api/v1/dev/test-accounts — the test accounts (scripts/test-accounts.ts,
// emails ending in @carma.test) the app can switch between. Development only:
// it exists only where the test-account header is accepted (`next dev`), and
// answers 404 everywhere else.
export async function GET() {
  try {
    if (!devAccountHeaderAllowed()) return apiError(404, "NOT_FOUND", "Not found.");
    const users = await prisma.user.findMany({
      where: { email: { endsWith: "@carma.test" } },
      orderBy: { id: "asc" },
      select: {
        name: true,
        email: true,
        account: {
          select: {
            id: true,
            profiles: { select: { type: true, isActive: true } },
            workshopsOwned: { select: { id: true } },
            garagesOwned: { select: { id: true, _count: { select: { vehicles: true } } } },
            garageMemberships: { where: { role: "MEMBER", removedAt: null }, select: { garage: { select: { name: true } } } },
            subscriptions: { where: { subject: "OWNER" }, select: { status: true, trialEndsAt: true }, orderBy: { createdAt: "desc" }, take: 1 },
          },
        },
      },
    });

    const accounts = users
      .filter((u) => u.account)
      .map((u) => {
        const a = u.account!;
        const vehicles = a.garagesOwned.reduce((n, g) => n + g._count.vehicles, 0);
        const mechanic = a.workshopsOwned.length > 0;
        const parts: string[] = [];
        if (mechanic) parts.push("Mechanic with a workshop");
        if (a.garagesOwned.length) parts.push(`${vehicles} vehicle${vehicles === 1 ? "" : "s"}`);
        for (const m of a.garageMemberships) parts.push(`Member of ${m.garage.name}`);
        const sub = a.subscriptions[0];
        if (sub?.status === "TRIALING" && sub.trialEndsAt && sub.trialEndsAt < new Date()) parts.push("Trial over, Free plan");
        if (parts.length === 0) parts.push("New: nothing set up");
        return {
          id: a.id,
          name: u.name,
          email: u.email,
          summary: parts.join(" · "),
          mode: mechanic ? "mechanic" : "owner",
          setUp: mechanic || a.garagesOwned.length > 0 || a.garageMemberships.length > 0,
        };
      });
    return apiOk(accounts);
  } catch (error) {
    return handleApiError(error);
  }
}
