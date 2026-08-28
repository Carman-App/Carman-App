import { redirect } from "next/navigation";
import { getPending2fa } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { startTwoFactorSetup } from "../actions";
import SetupForm from "./setup-form";

export default async function SetupTwoFactorPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const pending = await getPending2fa();
  if (!pending) redirect("/login");

  const admin = await prisma.adminUser.findUnique({ where: { id: pending.adminId } });
  if (!admin) redirect("/login");
  if (admin.twoFactorEnabled) redirect(`/login/verify?next=${encodeURIComponent(next ?? "/")}`);

  const initial = await startTwoFactorSetup();

  return (
    <div className="flex min-h-screen items-center justify-center bg-white px-4 py-10">
      <div className="w-full max-w-md rounded-lg border border-neutral-200 bg-neutral-50 p-8 shadow-xl">
        <h1 className="text-xl font-semibold text-neutral-900">Set up two-factor authentication</h1>
        <p className="mt-1 text-sm text-neutral-600">
          Required for every admin account before you can sign in ({admin.email}). Scan the QR
          code with an authenticator app (Google Authenticator, Authy, 1Password, etc.), then
          enter the 6-digit code it shows.
        </p>
        <SetupForm initial={initial} next={next ?? "/"} />
      </div>
    </div>
  );
}
