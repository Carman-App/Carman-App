"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { formatKes, PAYMENT_PURPOSES, PAYMENT_STATUSES, type Payment } from "@showrooms/shared";
import { PageHeader } from "@/components/layout/dashboard-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { AdminTable } from "@/features/admin/admin-table";
import { PAYMENT_TONE } from "@/features/billing/payment-tone";
import { api, apiPaged } from "@/lib/api-client";
import { errorMessage } from "@/lib/api-error";
import { formatDate } from "@/lib/utils";

type Row = Payment & { user?: { name: string; email: string }; checkoutRequestId?: string; callbackCount: number };

export default function AdminPaymentsPage() {
  const qc = useQueryClient();
  const [status, setStatus] = useState("");
  const [purpose, setPurpose] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: ["admin", "payments", status, purpose, q, page],
    queryFn: () => apiPaged<Row[], { totals: Record<string, { amountKes: number; count: number }> }>(`/admin/payments?page=${page}&limit=25${status ? `&status=${status}` : ""}${purpose ? `&purpose=${purpose}` : ""}${q ? `&q=${encodeURIComponent(q)}` : ""}`),
  });
  async function reconcile(p: Row) {
    try {
      const res = await api<Payment>(`/admin/payments/${p.id}/reconcile`, { method: "POST" });
      toast.success(`Status: ${res.status.toLowerCase()}`);
      qc.invalidateQueries({ queryKey: ["admin", "payments"] });
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }
  const totals = query.data?.meta.totals;
  return (
    <div>
      <PageHeader
        title="Payments"
        description="M-Pesa STK payments. Only verified callbacks or Daraja status queries mark a payment successful."
        actions={
          <>
            <Input placeholder="Receipt, phone or checkout id" value={q} onChange={(e) => (setQ(e.target.value), setPage(1))} className="w-56" aria-label="Search" />
            <Select aria-label="Status" value={status} onChange={(e) => (setStatus(e.target.value), setPage(1))} className="w-36"><option value="">All statuses</option>{PAYMENT_STATUSES.map((s) => <option key={s} value={s}>{s.toLowerCase()}</option>)}</Select>
            <Select aria-label="Purpose" value={purpose} onChange={(e) => (setPurpose(e.target.value), setPage(1))} className="w-36"><option value="">All</option>{PAYMENT_PURPOSES.map((s) => <option key={s} value={s}>{s.toLowerCase()}</option>)}</Select>
          </>
        }
      />
      {totals && (
        <div className="mb-4 flex flex-wrap gap-2 text-sm">
          {Object.entries(totals).map(([s, t]) => <Badge key={s} tone={PAYMENT_TONE[s as keyof typeof PAYMENT_TONE] ?? "neutral"}>{s.toLowerCase()}: {t.count} · {formatKes(t.amountKes)}</Badge>)}
        </div>
      )}
      <AdminTable
        loading={query.isLoading}
        error={query.error}
        rows={query.data?.data}
        page={page}
        totalPages={query.data?.meta.totalPages}
        onPage={setPage}
        columns={[
          { key: "date", header: "Date", cell: (p) => formatDate(p.createdAt, true) },
          { key: "user", header: "User", cell: (p) => p.user?.email ?? "—" },
          { key: "desc", header: "For", cell: (p) => p.description },
          { key: "amount", header: "Amount", cell: (p) => formatKes(p.amountKes), className: "tabular" },
          { key: "phone", header: "Phone", cell: (p) => p.phone },
          { key: "status", header: "Status", cell: (p) => <span><Badge tone={PAYMENT_TONE[p.status]}>{p.status.toLowerCase()}</Badge>{p.failureReason && <span className="block text-xs text-ink-muted">{p.failureReason}</span>}</span> },
          { key: "receipt", header: "Receipt", cell: (p) => <span className="font-mono text-xs">{p.mpesaReceiptNumber ?? "—"}</span> },
          { key: "cb", header: "Callbacks", cell: (p) => p.callbackCount },
          { key: "actions", header: "", cell: (p) => (p.status === "PENDING" ? <Button size="sm" variant="outline" onClick={() => reconcile(p)}>Reconcile</Button> : null) },
        ]}
      />
    </div>
  );
}
