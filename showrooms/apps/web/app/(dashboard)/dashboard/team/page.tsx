"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { DEALER_STAFF_ROLES, type DealerStaffMember } from "@showrooms/shared";
import { PageHeader } from "@/components/layout/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/input";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/misc";
import { useSellerProfile } from "@/features/dashboard/use-seller";
import { api } from "@/lib/api-client";
import { ApiError, errorMessage } from "@/lib/api-error";

export default function TeamPage() {
  const profile = useSellerProfile();
  const qc = useQueryClient();
  const isOwner = profile.data?.dealerRole === "OWNER";
  const staff = useQuery({ queryKey: ["staff"], queryFn: () => api<(DealerStaffMember & { status?: string })[]>("/dealers/me/staff"), enabled: isOwner });
  const [form, setForm] = useState({ name: "", email: "", phone: "", staffRole: "SALES" });
  const [busy, setBusy] = useState(false);
  const ent = profile.data?.entitlements;

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api("/dealers/me/staff", { method: "POST", body: { ...form, phone: form.phone || undefined } });
      toast.success("Staff added", { description: `${form.name} will get an email to set their password.` });
      setForm({ name: "", email: "", phone: "", staffRole: "SALES" });
      qc.invalidateQueries({ queryKey: ["staff"] });
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function remove(m: DealerStaffMember) {
    if (!confirm(`Remove ${m.name}? Their login will be deactivated immediately.`)) return;
    try {
      await api(`/dealers/me/staff/${m.userId}`, { method: "DELETE" });
      qc.invalidateQueries({ queryKey: ["staff"] });
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  if (profile.isLoading) return <Skeleton className="h-64" />;
  if (!isOwner) return <EmptyState title="Only the dealership owner manages the team" />;
  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader title="Team" description="Staff can add and edit inventory and handle leads. Only you manage the team, billing and profile." />
      {ent && !ent.features.staffAccounts ? (
        <div className="rounded-lg border border-accent/30 bg-accent-soft p-5 text-sm">Staff accounts are part of the Dealer plan. <Link className="font-semibold text-accent" href="/dashboard/subscription">Upgrade</Link></div>
      ) : (
        <Card>
          <CardHeader><CardTitle>Add staff {ent ? <span className="text-sm font-normal text-ink-muted">({staff.data?.length ?? 0} of {ent.staffLimit})</span> : null}</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={add} className="grid gap-3 sm:grid-cols-2">
              <Field label="Name" htmlFor="s-name"><Input id="s-name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
              <Field label="Email" htmlFor="s-email"><Input id="s-email" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
              <Field label="Phone (optional)" htmlFor="s-phone"><Input id="s-phone" type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
              <Field label="Role" htmlFor="s-role">
                <Select id="s-role" value={form.staffRole} onChange={(e) => setForm({ ...form, staffRole: e.target.value })}>
                  {DEALER_STAFF_ROLES.map((r) => <option key={r} value={r}>{r === "MANAGER" ? "Manager" : "Sales"}</option>)}
                </Select>
              </Field>
              <Button type="submit" loading={busy} className="sm:col-span-2 sm:justify-self-start">Add staff member</Button>
            </form>
          </CardContent>
        </Card>
      )}
      {staff.error && !(staff.error instanceof ApiError && staff.error.status === 403) ? <ErrorState message={errorMessage(staff.error)} /> : (
        <ul className="divide-y divide-border rounded-lg border border-border bg-white">
          {staff.data?.map((m) => (
            <li key={m.userId} className="flex items-center justify-between gap-3 p-4 text-sm">
              <span><strong>{m.name}</strong> · {m.email} · {m.staffRole === "MANAGER" ? "Manager" : "Sales"}{m.status && m.status !== "ACTIVE" ? ` · ${m.status.toLowerCase()}` : ""}</span>
              <Button size="sm" variant="outline" onClick={() => remove(m)}>Remove</Button>
            </li>
          ))}
          {staff.data && !staff.data.length && <li className="p-4 text-sm text-ink-muted">No staff yet.</li>}
        </ul>
      )}
    </div>
  );
}
