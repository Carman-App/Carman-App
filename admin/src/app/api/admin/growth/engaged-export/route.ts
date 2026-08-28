import { getSession } from "@/lib/auth/session";
import { GROWTH_ROLES } from "@/lib/auth/rbac";
import { getEngagementShortlist } from "@/lib/growth/engagement";

export const dynamic = "force-dynamic";

// GROW-08 export, mirroring src/app/api/admin/accounts/no-vehicle-export/route.ts's
// pattern: a signed-in-admin-session route (not one of the mobile-facing
// /api/v1/* routes), checking role the same way the dashboard pages do.
export async function GET() {
  const session = await getSession();
  if (!session || !GROWTH_ROLES.includes(session.role)) {
    return new Response("Forbidden", { status: 403 });
  }

  const rows = await getEngagementShortlist(90);

  const header = [
    "accountId",
    "name",
    "email",
    "region",
    "recordCount90d",
    "distinctWeeksActive90d",
    "score",
    "contactPermission",
    "chasedEngagementAt",
  ];
  const csvEscape = (v: unknown) => {
    if (v == null) return "";
    const s = typeof v === "string" ? v : String(v);
    return `"${s.replace(/"/g, '""')}"`;
  };
  const rowsCsv = rows.map((r) =>
    [
      r.accountId,
      r.name,
      r.email,
      r.region,
      r.recordCount,
      r.distinctWeeksActive,
      r.score,
      r.contactPermission,
      r.chasedEngagementAt?.toISOString() ?? "",
    ]
      .map(csvEscape)
      .join(","),
  );
  const csv = [header.join(","), ...rowsCsv].join("\n");

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="growth-most-engaged-export.csv"`,
    },
  });
}
