import Link from "next/link";
import { requireRole, TRUST_ROLES } from "@/lib/auth/rbac";
import { NewReportForm } from "./new-report-form";

export const dynamic = "force-dynamic";

export default async function NewReportPage() {
  await requireRole(TRUST_ROLES);

  return (
    <div className="max-w-xl space-y-4">
      <div>
        <Link href="/trust" className="text-sm text-neutral-500 hover:text-neutral-800">
          ← Reports & disputes
        </Link>
        <h1 className="mt-1 text-lg font-semibold text-neutral-900">Log a report</h1>
        <p className="text-sm text-neutral-500">
          There is no in-app &ldquo;report&rdquo; button yet, so reports that arrive by phone or
          email are logged here.
        </p>
      </div>
      <NewReportForm />
    </div>
  );
}
