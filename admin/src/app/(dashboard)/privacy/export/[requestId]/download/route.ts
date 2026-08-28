import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth/session";
import { PRIVACY_ROLES } from "@/lib/auth/rbac";
import { writeAdminAuditLog } from "@/lib/audit";
import { buildAccountDataExport } from "@/lib/privacy/export";
import { DataExportStatus } from "@/generated/prisma/enums";

export const dynamic = "force-dynamic";

// PRIV-01 download step. Session/role-checked the same way
// src/app/(dashboard)/billing/export/route.ts is (getSession()/role check,
// not requireRole()'s redirect/forbidden — those are meant for Server
// Components/Actions, not Route Handlers).
//
// The full JSON body is never stored (only the recordCounts summary lives on
// the DataExportRequest row), so this regenerates the export fresh at
// download time rather than persisting a potentially large blob — in the
// synchronous generate-then-download flow this happens seconds apart, so
// content should match what was counted at generation time. Marks
// downloadedAt/status DOWNLOADED on the underlying request and audit-logs
// the download as a distinct event from the generate one.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ requestId: string }> }) {
  const session = await getSession();
  if (!session || !PRIVACY_ROLES.includes(session.role)) {
    return new Response("Forbidden", { status: 403 });
  }

  const { requestId } = await params;
  const request = await prisma.dataExportRequest.findUnique({ where: { id: requestId } });
  if (!request) {
    return new Response("Export request not found.", { status: 404 });
  }

  const payload = await buildAccountDataExport(request.accountId);
  if (!payload) {
    return new Response("The account this export was for no longer exists.", { status: 410 });
  }

  const now = new Date();
  await prisma.dataExportRequest.update({
    where: { id: request.id },
    data: { downloadedAt: now, status: DataExportStatus.DOWNLOADED },
  });

  await writeAdminAuditLog(
    { adminId: session.adminId },
    {
      action: "privacy.data_export_download",
      entityType: "DataExportRequest",
      entityId: request.id,
      targetAccountId: request.accountId,
      reason: request.reason,
      metadata: { recordCounts: request.recordCounts },
    },
  );

  return new Response(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="carma-data-export-${request.accountId}-${request.id}.json"`,
    },
  });
}
