import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth/session";
import { ACCOUNTS_ROLES } from "@/lib/auth/rbac";
import { Region } from "@/generated/prisma/enums";
import { buildNoVehicleWhere } from "@/lib/accounts/no-vehicle";

export const dynamic = "force-dynamic";

// ACCT-04 export, mirroring src/app/api/admin/audit/export/route.ts's
// pattern: a signed-in-admin-session route (not one of the mobile-facing
// /api/v1/* routes), checking role the same way the dashboard pages do.
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session || !ACCOUNTS_ROLES.includes(session.role)) {
    return new Response("Forbidden", { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const minAgeDaysRaw = searchParams.get("minAgeDays");
  const minAgeDays = minAgeDaysRaw ? Number(minAgeDaysRaw) : undefined;
  const regionRaw = searchParams.get("region");
  const region = regionRaw && regionRaw in Region ? (regionRaw as Region) : undefined;
  const includeChased = searchParams.get("includeChased") === "1";

  const where = buildNoVehicleWhere({ minAgeDays, region, includeChased });
  const accounts = await prisma.account.findMany({
    where,
    include: { user: true },
    orderBy: { createdAt: "asc" },
    take: 10000,
  });

  const header = ["id", "name", "email", "region", "createdAt", "chasedNoVehicleAt", "chasedNoVehicleByAdminId"];
  const csvEscape = (v: unknown) => {
    if (v == null) return "";
    const s = typeof v === "string" ? v : String(v);
    return `"${s.replace(/"/g, '""')}"`;
  };
  const rows = accounts.map((a) =>
    [
      a.id,
      a.user.name,
      a.user.email,
      a.region,
      a.createdAt.toISOString(),
      a.chasedNoVehicleAt?.toISOString() ?? "",
      a.chasedNoVehicleByAdminId ?? "",
    ]
      .map(csvEscape)
      .join(","),
  );
  const csv = [header.join(","), ...rows].join("\n");

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="accounts-no-vehicle-export.csv"`,
    },
  });
}
