"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { ROLE_LABELS, type PublicUser } from "@showrooms/shared";
import { PageHeader } from "@/components/layout/dashboard-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";
import { useAuth } from "@/features/auth/auth-provider";
import { api } from "@/lib/api-client";
import { ApiError, errorMessage } from "@/lib/api-error";

export default function SettingsPage() {
  const { user, updateUser, signOut } = useAuth();
  const router = useRouter();
  const form = useForm<{ name: string; phone: string }>();
  useEffect(() => {
    if (user) form.reset({ name: user.name, phone: user.phone ?? "" });
  }, [user, form]);

  async function save(v: { name: string; phone: string }) {
    try {
      updateUser(await api<PublicUser>("/users/me", { method: "PATCH", body: { name: v.name, phone: v.phone || null } }));
      toast.success("Saved");
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) Object.entries(err.fieldErrors()).forEach(([k, m]) => form.setError(k as "name", { message: m }));
      else toast.error(errorMessage(err));
    }
  }
  if (!user) return null;
  return (
    <div className="max-w-xl space-y-6">
      <PageHeader title="Account" />
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2">Profile <Badge>{ROLE_LABELS[user.role]}</Badge></CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(save)} className="grid gap-4">
            <Field label="Email" htmlFor="email" hint="Contact support to change your email."><Input id="email" value={user.email} disabled /></Field>
            <Field label="Name" htmlFor="name" error={form.formState.errors.name?.message}><Input id="name" {...form.register("name")} /></Field>
            <Field label="Phone" htmlFor="phone" error={form.formState.errors.phone?.message}><Input id="phone" type="tel" {...form.register("phone")} /></Field>
            <Button type="submit" loading={form.formState.isSubmitting} className="justify-self-start">Save</Button>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Security</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button variant="outline" asChild><Link href="/forgot-password">Change password</Link></Button>
          <Button variant="outline" onClick={async () => { await signOut(); router.push("/"); }}>Log out</Button>
        </CardContent>
      </Card>
    </div>
  );
}
