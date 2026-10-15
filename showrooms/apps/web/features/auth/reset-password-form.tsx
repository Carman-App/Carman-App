"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { passwordSchema } from "@showrooms/shared";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { api } from "@/lib/api-client";
import { errorMessage } from "@/lib/api-error";

const schema = z.object({ password: passwordSchema, confirm: z.string() }).refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Passwords don't match" });

export function ResetPasswordForm() {
  const params = useSearchParams();
  const token = params.get("token");
  const welcome = params.get("welcome") === "1";
  const [done, setDone] = useState(false);
  const form = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema), defaultValues: { password: "", confirm: "" } });

  async function onSubmit(values: z.infer<typeof schema>) {
    try {
      await api("/auth/reset-password", { method: "POST", body: { token, password: values.password } });
      setDone(true);
    } catch (err) {
      form.setError("root", { message: errorMessage(err) });
    }
  }
  if (!token) return <p className="text-sm text-danger">This link is missing its token. Request a new reset link.</p>;
  return (
    <>
      <h1 className="text-2xl font-extrabold tracking-tight">{welcome ? "Set your password" : "Choose a new password"}</h1>
      {done ? (
        <div className="mt-4 space-y-4">
          <p className="rounded-md bg-success-soft p-4 text-sm text-success" role="status">Password saved. You&apos;ve been signed out everywhere else.</p>
          <Button asChild className="w-full"><Link href="/login">Log in</Link></Button>
        </div>
      ) : (
        <form onSubmit={form.handleSubmit(onSubmit)} className="mt-6 grid gap-4" noValidate>
          <Field label="New password" htmlFor="password" error={form.formState.errors.password?.message}>
            <Input id="password" type="password" autoComplete="new-password" {...form.register("password")} />
          </Field>
          <Field label="Confirm password" htmlFor="confirm" error={form.formState.errors.confirm?.message}>
            <Input id="confirm" type="password" autoComplete="new-password" {...form.register("confirm")} />
          </Field>
          {form.formState.errors.root && <p role="alert" className="text-sm text-danger">{form.formState.errors.root.message}</p>}
          <Button type="submit" loading={form.formState.isSubmitting}>Save password</Button>
        </form>
      )}
    </>
  );
}
