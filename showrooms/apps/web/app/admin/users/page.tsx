"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ROLE_LABELS, USER_ROLES, USER_STATUSES, type PublicUser } from "@showrooms/shared";
import { PageHeader } from "@/components/layout/dashboard-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { AdminTable } from "@/features/admin/admin-table";
import { api, apiPaged } from "@/lib/api-client";
import { errorMessage } from "@/lib/api-error";
import { formatDate } from "@/lib/utils";

export default function AdminUsersPage() {
  const qc = useQueryClient();
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const query = useQuery({ queryKey: ["admin", "users", role, status, q, page], queryFn: () => apiPaged<PublicUser[]>(`/admin/users?page=${page}&limit=25${role ? `&role=${role}` : ""}${status ? `&status=${status}` : ""}${q ? `&q=${encodeURIComponent(q)}` : ""}`) });

  async function setUserStatus(u: PublicUser, next: "ACTIVE" | "SUSPENDED") {
    const reason = next === "SUSPENDED" ? prompt(`Why suspend ${u.name}?`) : undefined;
    if (next === "SUSPENDED" && !reason) return;
    try {
      await api(`/admin/users/${u.id}/status`, { method: "PATCH", body: { status: next, reason: reason ?? undefined } });
      toast.success(next === "SUSPENDED" ? "Suspended; their sessions were ended" : "Reactivated");
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  return (
    <div>
      <PageHeader
        title="Users"
        actions={
          <>
            <Input placeholder="Name, email or phone" value={q} onChange={(e) => (setQ(e.target.value), setPage(1))} className="w-56" aria-label="Search" />
            <Select aria-label="Role" value={role} onChange={(e) => (setRole(e.target.value), setPage(1))} className="w-36"><option value="">All roles</option>{USER_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}</Select>
            <Select aria-label="Status" value={status} onChange={(e) => (setStatus(e.target.value), setPage(1))} className="w-36"><option value="">All statuses</option>{USER_STATUSES.map((s) => <option key={s} value={s}>{s.toLowerCase()}</option>)}</Select>
          </>
        }
      />
      <AdminTable
        loading={query.isLoading}
        error={query.error}
        rows={query.data?.data}
        page={page}
        totalPages={query.data?.meta.totalPages}
        onPage={setPage}
        columns={[
          { key: "name", header: "Name", cell: (u) => <span className="font-medium">{u.name}</span> },
          { key: "email", header: "Email", cell: (u) => u.email },
          { key: "phone", header: "Phone", cell: (u) => u.phone ?? "—" },
          { key: "role", header: "Role", cell: (u) => <Badge>{ROLE_LABELS[u.role]}</Badge> },
          { key: "status", header: "Status", cell: (u) => <Badge tone={u.status === "ACTIVE" ? "success" : "danger"}>{u.status.toLowerCase()}</Badge> },
          { key: "joined", header: "Joined", cell: (u) => formatDate(u.createdAt) },
          { key: "actions", header: "", cell: (u) => (u.role === "ADMIN" ? null : u.status === "ACTIVE" ? <Button size="sm" variant="outline" onClick={() => setUserStatus(u, "SUSPENDED")}>Suspend</Button> : <Button size="sm" variant="outline" onClick={() => setUserStatus(u, "ACTIVE")}>Reactivate</Button>) },
        ]}
      />
    </div>
  );
}
