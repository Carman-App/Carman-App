"use client";

import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { forgotPasswordSchema, type ForgotPasswordInput } from "@showrooms/shared";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { api } from "@/lib/api-client";
import { errorMessage } from "@/lib/api-error";

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const form = useForm<ForgotPasswordInput>({ resolver: zodResolver(forgotPasswordSchema), defaultValues: { email: "" } });
  async function onSubmit(values: ForgotPasswordInput) {
    try {
      await api("/auth/forgot-password", { method: "POST", body: values });
      setSent(true);
    } catch (err) {
      form.setError("root", { message: errorMessage(err) });
    }
  }
  return (
    <>
      <h1 className="text-2xl font-extrabold tracking-tight">Reset your password</h1>
      {sent ? (
        <p className="mt-4 rounded-md bg-success-soft p-4 text-sm text-success" role="status">If an account exists for that email, we&apos;ve sent a reset link. It expires in 30 minutes.</p>
      ) : (
        <form onSubmit={form.handleSubmit(onSubmit)} className="mt-6 grid gap-4" noValidate>
          <Field label="Email" htmlFor="email" error={form.formState.errors.email?.message}>
            <Input id="email" type="email" autoComplete="email" {...form.register("email")} />
          </Field>
          {form.formState.errors.root && <p role="alert" className="text-sm text-danger">{form.formState.errors.root.message}</p>}
          <Button type="submit" loading={form.formState.isSubmitting}>Send reset link</Button>
        </form>
      )}
      <p className="mt-6 text-center text-sm"><Link href="/login" className="text-accent hover:underline">Back to log in</Link></p>
    </>
  );
}
