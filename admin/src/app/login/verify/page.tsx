import { redirect } from "next/navigation";
import { getPending2fa } from "@/lib/auth/session";
import VerifyForm from "./verify-form";

export default async function VerifyTwoFactorPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const pending = await getPending2fa();
  if (!pending) redirect("/login");

  return (
    <div className="flex min-h-screen items-center justify-center bg-white px-4">
      <div className="w-full max-w-sm rounded-lg border border-neutral-200 bg-neutral-50 p-8 shadow-xl">
        <h1 className="text-xl font-semibold text-neutral-900">Two-factor code</h1>
        <p className="mt-1 text-sm text-neutral-600">
          Enter the 6-digit code from your authenticator app for {pending.email}.
        </p>
        <VerifyForm next={next ?? "/"} />
      </div>
    </div>
  );
}
