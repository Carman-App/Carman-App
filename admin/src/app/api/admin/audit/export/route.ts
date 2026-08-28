import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth/session";
import { AUDIT_LOG_ROLES } from "@/lib/auth/rbac";
import type { Prisma } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

// AUD-02: "export everything done to one account" (and, more generally,
// whatever the current filter matches). This is a signed-in-admin-session
// route (cookie-based), not one of the mobile-facing /api/v1/* routes, so
// it checks role the same way the dashboard pages do rather than via
// src/lib/api/auth.ts's x-carma-account-id header scheme.
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session || !AUDIT_LOG_ROLES.includes(session.role)) {
    return new Response("Forbidden", { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const where: Prisma.AuditLogWhereInput = {};
  const actorId = searchParams.get("actorId");
  const targetAccountId = searchParams.get("targetAccountId");
  const action = searchParams.get("action");
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  if (actorId) where.actorId = actorId;
  if (targetAccountId) where.targetAccountId = targetAccountId;
  if (action) where.action = { contains: action, mode: "insensitive" };
  if (from || to) {
    where.createdAt = {
      ...(from ? { gte: new Date(from) } : {}),
      ...(to ? { lte: new Date(to + "T23:59:59.999Z") } : {}),
    };
  }

  const entries = await prisma.auditLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 10000,
  });

  const header = [
    "id",
    "createdAt",
    "actorType",
    "actorId",
    "action",
    "entityType",
    "entityId",
    "targetAccountId",
    "reason",
    "ipAddress",
    "beforeData",
    "afterData",
    "metadata",
  ];
  const csvEscape = (v: unknown) => {
    if (v == null) return "";
    const s = typeof v === "string" ? v : JSON.stringify(v);
    return `"${s.replace(/"/g, '""')}"`;
  };
  const rows = entries.map((e) =>
    [
      e.id,
      e.createdAt.toISOString(),
      e.actorType,
      e.actorId,
      e.action,
      e.entityType,
      e.entityId,
      e.targetAccountId,
      e.reason,
      e.ipAddress,
      e.beforeData,
      e.afterData,
      e.metadata,
    ]
      .map(csvEscape)
      .join(","),
  );
  const csv = [header.join(","), ...rows].join("\n");

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="audit-log-export.csv"`,
    },
  });
}
