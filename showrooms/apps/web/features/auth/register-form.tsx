"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Building2, Search, Store } from "lucide-react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { registerSchema, SELF_ASSIGNABLE_ROLES, type AuthSession, type RegisterInput, type SelfAssignableRole } from "@showrooms/shared";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { api } from "@/lib/api-client";
import { ApiError, errorMessage } from "@/lib/api-error";
import { cn } from "@/lib/utils";
import { useAuth } from "./auth-provider";
import { safeNext } from "./safe-next";

const ROLES: Record<SelfAssignableRole, { title: string; body: string; icon: typeof Search }> = {
  BUYER: { title: "I'm buying", body: "Save cars, follow showrooms, request viewings.", icon: Search },
  BROKER: { title: "I'm a broker", body: "Get a showroom and share listings to WhatsApp.", icon: Store },
  DEALER: { title: "I'm a dealer", body: "Inventory, staff accounts and a storefront.", icon: Building2 },
};

export function RegisterForm() {
  const { signIn } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const initialRole = (SELF_ASSIGNABLE_ROLES as readonly string[]).includes(params.get("role") ?? "") ? (params.get("role") as SelfAssignableRole) : "BUYER";
  const form = useForm<RegisterInput>({ resolver: zodResolver(registerSchema), defaultValues: { name: "", email: "", phone: "", password: "", role: initialRole } });
  const role = useWatch({ control: form.control, name: "role" }) ?? "BUYER";

  async function onSubmit(values: RegisterInput) {
    try {
      const session = await api<AuthSession>("/auth/register", { method: "POST", body: { ...values, phone: values.phone || undefined } });
      signIn(session);
      router.replace(role === "BUYER" ? safeNext(params.get("next"), "/vehicles") : "/dashboard/profile?welcome=1");
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) Object.entries(err.fieldErrors()).forEach(([k, m]) => form.setError(k as keyof RegisterInput, { message: m }));
      else if (err instanceof ApiError && err.code === "EMAIL_TAKEN") form.setError("email", { message: err.message });
      else if (err instanceof ApiError && err.code === "PHONE_TAKEN") form.setError("phone", { message: err.message });
      else form.setError("root", { message: errorMessage(err) });
    }
  }

  return (
    <>
      <h1 className="text-2xl font-extrabold tracking-tight">Create your account</h1>
      <form onSubmit={form.handleSubmit(onSubmit)} className="mt-6 grid gap-4" noValidate>
        <fieldset className="grid gap-2">
          <legend className="mb-2 text-sm font-medium">How will you use Showrooms?</legend>
          {SELF_ASSIGNABLE_ROLES.map((r) => {
            const { title, body, icon: Icon } = ROLES[r];
            return (
              <label key={r} className={cn("flex cursor-pointer items-start gap-3 rounded-lg border p-3", role === r ? "border-accent bg-accent-soft" : "border-border hover:bg-surface")}>
                <input type="radio" value={r} className="sr-only" {...form.register("role")} />
                <Icon className={cn("mt-0.5 size-5", role === r ? "text-accent" : "text-ink-muted")} aria-hidden />
                <span>
                  <span className="block text-sm font-semibold">{title}</span>
                  <span className="block text-xs text-ink-muted">{body}</span>
                </span>
              </label>
            );
          })}
        </fieldset>
        <Field label={role === "BUYER" ? "Full name" : role === "DEALER" ? "Dealership name" : "Name or business name"} htmlFor="name" error={form.formState.errors.name?.message}>
          <Input id="name" autoComplete={role === "BUYER" ? "name" : "organization"} {...form.register("name")} />
        </Field>
        <Field label="Email" htmlFor="email" error={form.formState.errors.email?.message}>
          <Input id="email" type="email" autoComplete="email" {...form.register("email")} />
        </Field>
        <Field label={role === "BUYER" ? "Phone (optional)" : "WhatsApp number"} htmlFor="phone" hint="Kenyan number, e.g. 0712 345 678" error={form.formState.errors.phone?.message}>
          <Input id="phone" type="tel" inputMode="tel" autoComplete="tel" {...form.register("phone")} />
        </Field>
        <Field label="Password" htmlFor="password" hint="At least 8 characters with a letter and a number." error={form.formState.errors.password?.message}>
          <Input id="password" type="password" autoComplete="new-password" {...form.register("password")} />
        </Field>
        {form.formState.errors.root && <p role="alert" className="rounded-md bg-danger-soft p-3 text-sm text-danger">{form.formState.errors.root.message}</p>}
        <Button type="submit" size="lg" loading={form.formState.isSubmitting}>Create account</Button>
      </form>
      <p className="mt-6 text-center text-sm text-ink-muted">
        Already have an account? <Link href="/login" className="font-semibold text-accent hover:underline">Log in</Link>
      </p>
    </>
  );
}
