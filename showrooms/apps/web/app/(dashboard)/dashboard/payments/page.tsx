"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatKes, type Payment } from "@showrooms/shared";
import { PageHeader } from "@/components/layout/dashboard-shell";
import { PAYMENT_TONE } from "@/features/billing/payment-tone";
import { Badge } from "@/components/ui/badge";
import { EmptyState, ErrorState, Pagination, Skeleton } from "@/components/ui/misc";
import { apiPaged } from "@/lib/api-client";
import { errorMessage } from "@/lib/api-error";
import { formatDate } from "@/lib/utils";

export default function PaymentsPage() {
  const [page, setPage] = useState(1);
  const q = useQuery({ queryKey: ["payments", page], queryFn: () => apiPaged<Payment[]>(`/payments/me?page=${page}`) });
  return (
    <div>
      <PageHeader title="Payment history" description="M-Pesa payments for plans and promotions." />
      {q.isLoading ? <Skeleton className="h-64" /> : q.error ? <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} /> : !q.data?.data.length ? <EmptyState title="No payments yet" /> : (
        <div className="overflow-x-auto rounded-lg border border-border bg-white shadow-card">
          <table className="w-full text-sm">
            <thead className="bg-surface text-left text-xs text-ink-muted uppercase"><tr><th className="p-3">Date</th><th className="p-3">For</th><th className="p-3 text-right">Amount</th><th className="p-3">Status</th><th className="p-3">M-Pesa receipt</th></tr></thead>
            <tbody className="divide-y divide-border">
              {q.data.data.map((p) => (
                <tr key={p.id}>
                  <td className="p-3 whitespace-nowrap">{formatDate(p.createdAt, true)}</td>
                  <td className="p-3">{p.description}</td>
                  <td className="p-3 text-right tabular">{formatKes(p.amountKes)}</td>
                  <td className="p-3"><Badge tone={PAYMENT_TONE[p.status]}>{p.status.toLowerCase()}</Badge>{p.failureReason && <p className="mt-1 text-xs text-ink-muted">{p.failureReason}</p>}</td>
                  <td className="p-3 font-mono text-xs">{p.mpesaReceiptNumber ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {q.data && <Pagination page={page} totalPages={q.data.meta.totalPages} onPage={setPage} />}
    </div>
  );
}
