"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/dashboard-shell";
import { Input } from "@/components/ui/input";
import { AdminTable } from "@/features/admin/admin-table";
import { apiPaged } from "@/lib/api-client";
import { formatDate } from "@/lib/utils";

interface Row { id: string; action: string; actor?: { name: string; email: string }; actorRole?: string; entityType?: string; entityId?: string; metadata?: Record<string, unknown>; ip?: string; createdAt: string }

export default function AuditLogsPage() {
  const [action, setAction] = useState("");
  const [page, setPage] = useState(1);
  const q = useQuery({ queryKey: ["admin", "audit", action, page], queryFn: () => apiPaged<Row[]>(`/admin/audit-logs?page=${page}&limit=50${action ? `&action=${encodeURIComponent(action)}` : ""}`) });
  return (
    <div>
      <PageHeader title="Audit logs" description="Security and administrative actions. Append-only." actions={<Input placeholder="Action prefix, e.g. vehicle." value={action} onChange={(e) => (setAction(e.target.value), setPage(1))} className="w-60" aria-label="Filter by action" />} />
      <AdminTable
        loading={q.isLoading}
        error={q.error}
        rows={q.data?.data}
        page={page}
        totalPages={q.data?.meta.totalPages}
        onPage={setPage}
        columns={[
          { key: "when", header: "When", cell: (r) => <span className="whitespace-nowrap">{formatDate(r.createdAt, true)}</span> },
          { key: "action", header: "Action", cell: (r) => <code className="text-xs">{r.action}</code> },
          { key: "actor", header: "Actor", cell: (r) => r.actor?.email ?? (r.actorRole ? r.actorRole.toLowerCase() : "system") },
          { key: "entity", header: "Entity", cell: (r) => (r.entityType ? `${r.entityType} ${r.entityId?.slice(-6) ?? ""}` : "—") },
          { key: "meta", header: "Details", cell: (r) => <code className="block max-w-sm truncate text-xs text-ink-muted" title={JSON.stringify(r.metadata)}>{r.metadata ? JSON.stringify(r.metadata) : ""}</code> },
          { key: "ip", header: "IP", cell: (r) => r.ip ?? "—" },
        ]}
      />
    </div>
  );
}
