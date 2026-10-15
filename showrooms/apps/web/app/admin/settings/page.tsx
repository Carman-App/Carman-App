"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { formatKes, type BoostPackage } from "@showrooms/shared";
import { PageHeader } from "@/components/layout/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/misc";
import { api } from "@/lib/api-client";
import { errorMessage } from "@/lib/api-error";

interface Settings { requireListingApproval: boolean; autoApproveVerifiedSellers: boolean; supportPhone: string; supportEmail: string; boostPackages: BoostPackage[]; reportAutoFlagThreshold: number; soldListingVisibleDays: number }

export default function AdminSettingsPage() {
  const q = useQuery({ queryKey: ["admin", "settings"], queryFn: () => api<Settings>("/admin/settings") });
  if (!q.data) return <Skeleton className="h-96" />;
  return <SettingsForm initial={q.data} />;
}

function SettingsForm({ initial }: { initial: Settings }) {
  const qc = useQueryClient();
  const [s, setS] = useState<Settings>(initial);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      setS(await api<Settings>("/admin/settings", { method: "PATCH", body: s }));
      toast.success("Settings saved");
      qc.invalidateQueries({ queryKey: ["admin", "settings"] });
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  const pkg = (i: number, patch: Partial<BoostPackage>) => setS({ ...s, boostPackages: s.boostPackages.map((p, j) => (i === j ? { ...p, ...patch } : p)) });
  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader title="Platform settings" actions={<Button onClick={save} loading={busy}>Save changes</Button>} />
      <Card>
        <CardHeader><CardTitle>Listing moderation</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          <label className="flex items-center gap-2"><input type="checkbox" checked={s.requireListingApproval} onChange={(e) => setS({ ...s, requireListingApproval: e.target.checked })} /> New listings need admin approval</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={s.autoApproveVerifiedSellers} onChange={(e) => setS({ ...s, autoApproveVerifiedSellers: e.target.checked })} /> Publish verified sellers&apos; listings automatically (unless flagged as possible duplicates)</label>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Auto-flag after this many open reports" htmlFor="flag"><Input id="flag" type="number" min={1} value={s.reportAutoFlagThreshold} onChange={(e) => setS({ ...s, reportAutoFlagThreshold: Number(e.target.value) })} /></Field>
            <Field label="Days sold listings stay visible" htmlFor="sold"><Input id="sold" type="number" min={0} value={s.soldListingVisibleDays} onChange={(e) => setS({ ...s, soldListingVisibleDays: Number(e.target.value) })} /></Field>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Promotion packages</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {s.boostPackages.map((p, i) => (
            <div key={p.code} className="grid grid-cols-2 gap-2 sm:grid-cols-[120px_1fr_90px_110px] sm:items-end">
              <Field label="Code" htmlFor={`p-${i}`}><Input id={`p-${i}`} value={p.code} disabled /></Field>
              <Field label="Name" htmlFor={`pn-${i}`}><Input id={`pn-${i}`} value={p.name} onChange={(e) => pkg(i, { name: e.target.value })} /></Field>
              <Field label="Days" htmlFor={`pd-${i}`}><Input id={`pd-${i}`} type="number" value={p.days} onChange={(e) => pkg(i, { days: Number(e.target.value) })} /></Field>
              <Field label={`Price (${formatKes(p.priceKes)})`} htmlFor={`pp-${i}`}><Input id={`pp-${i}`} type="number" value={p.priceKes} onChange={(e) => pkg(i, { priceKes: Number(e.target.value) })} /></Field>
            </div>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Support contacts</CardTitle></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <Field label="Support phone" htmlFor="sp"><Input id="sp" value={s.supportPhone} onChange={(e) => setS({ ...s, supportPhone: e.target.value })} /></Field>
          <Field label="Support email" htmlFor="se"><Input id="se" type="email" value={s.supportEmail} onChange={(e) => setS({ ...s, supportEmail: e.target.value })} /></Field>
        </CardContent>
      </Card>
    </div>
  );
}
