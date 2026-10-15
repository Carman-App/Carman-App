"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { VERIFICATION_STATUSES } from "@showrooms/shared";
import { PageHeader } from "@/components/layout/dashboard-shell";
import { Badge } from "@/components/ui/badge";
import { Input, Select } from "@/components/ui/input";
import { apiPaged } from "@/lib/api-client";
import { formatDate } from "@/lib/utils";
import { AdminTable } from "./admin-table";

interface Row { id: string; slug: string; displayName?: string; businessName?: string; town?: string; verificationStatus: string; activeListingCount: number; ratingAvg: number; ratingCount: number; phone?: string; createdAt: string }

export function ProfilesTable({ kind }: { kind: "brokers" | "dealers" }) {
  const [q, setQ] = useState("");
  const [v, setV] = useState("");
  const [page, setPage] = useState(1);
  const query = useQuery({ queryKey: ["admin", kind, q, v, page], queryFn: () => apiPaged<Row[]>(`/admin/${kind}?page=${page}&limit=25${q ? `&q=${encodeURIComponent(q)}` : ""}${v ? `&verificationStatus=${v}` : ""}`) });
  return (
    <div>
      <PageHeader
        title={kind === "brokers" ? "Brokers" : "Dealers"}
        description="Verification requests are reviewed under Verifications."
        actions={
          <>
            <Input placeholder="Search" value={q} onChange={(e) => (setQ(e.target.value), setPage(1))} className="w-48" aria-label="Search" />
            <Select aria-label="Verification" value={v} onChange={(e) => (setV(e.target.value), setPage(1))} className="w-40"><option value="">Any verification</option>{VERIFICATION_STATUSES.map((s) => <option key={s} value={s}>{s.replace("_", " ").toLowerCase()}</option>)}</Select>
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
          { key: "name", header: "Name", cell: (r) => <Link href={`/${kind}/${r.slug}`} target="_blank" className="font-medium hover:underline">{r.displayName ?? r.businessName}</Link> },
          { key: "town", header: "Town", cell: (r) => r.town ?? "—" },
          { key: "phone", header: "Phone", cell: (r) => r.phone ?? "—" },
          { key: "verification", header: "Verification", cell: (r) => <Badge tone={r.verificationStatus === "VERIFIED" ? "success" : r.verificationStatus === "PENDING" ? "info" : "neutral"}>{r.verificationStatus.replace("_", " ").toLowerCase()}</Badge> },
          { key: "listings", header: "Active", cell: (r) => r.activeListingCount, className: "tabular" },
          { key: "rating", header: "Rating", cell: (r) => (r.ratingCount ? `${r.ratingAvg.toFixed(1)} (${r.ratingCount})` : "—") },
          { key: "joined", header: "Joined", cell: (r) => formatDate(r.createdAt) },
        ]}
      />
    </div>
  );
}
