"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema, type AuthSession, type LoginInput } from "@showrooms/shared";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { api } from "@/lib/api-client";
import { errorMessage } from "@/lib/api-error";
import { useAuth } from "./auth-provider";
import { safeNext } from "./safe-next";

export function LoginForm() {
  const { signIn } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const form = useForm<LoginInput>({ resolver: zodResolver(loginSchema), defaultValues: { email: "", password: "" } });

  async function onSubmit(values: LoginInput) {
    try {
      const session = await api<AuthSession>("/auth/login", { method: "POST", body: values });
      signIn(session);
      router.replace(safeNext(params.get("next"), session.user.role === "ADMIN" ? "/admin" : "/dashboard"));
    } catch (err) {
      form.setError("root", { message: errorMessage(err) });
    }
  }

  return (
    <>
      <h1 className="text-2xl font-extrabold tracking-tight">Welcome back</h1>
      <p className="mt-1 text-sm text-ink-muted">Log in to your Showrooms account.</p>
      <form onSubmit={form.handleSubmit(onSubmit)} className="mt-6 grid gap-4" noValidate>
        <Field label="Email" htmlFor="email" error={form.formState.errors.email?.message}>
          <Input id="email" type="email" autoComplete="email" aria-invalid={!!form.formState.errors.email} {...form.register("email")} />
        </Field>
        <Field label="Password" htmlFor="password" error={form.formState.errors.password?.message}>
          <Input id="password" type="password" autoComplete="current-password" aria-invalid={!!form.formState.errors.password} {...form.register("password")} />
        </Field>
        {form.formState.errors.root && <p role="alert" className="rounded-md bg-danger-soft p-3 text-sm text-danger">{form.formState.errors.root.message}</p>}
        <Button type="submit" size="lg" loading={form.formState.isSubmitting}>Log in</Button>
      </form>
      <div className="mt-6 flex justify-between text-sm">
        <Link href="/forgot-password" className="text-ink-muted hover:text-ink">Forgot password?</Link>
        <Link href={`/register${params.get("next") ? `?next=${encodeURIComponent(params.get("next")!)}` : ""}`} className="font-semibold text-accent hover:underline">Create account</Link>
      </div>
    </>
  );
}
