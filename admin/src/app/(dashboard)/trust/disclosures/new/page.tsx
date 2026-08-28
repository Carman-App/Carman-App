import Link from "next/link";
import { requireRole, TRUST_DANGEROUS_ROLES } from "@/lib/auth/rbac";
import { NewDisclosureForm } from "../new-disclosure-form";

export const dynamic = "force-dynamic";

export default async function NewDisclosurePage() {
  await requireRole(TRUST_DANGEROUS_ROLES);

  return (
    <div className="max-w-2xl space-y-4">
      <div>
        <Link href="/trust/disclosures" className="text-sm text-neutral-500 hover:text-neutral-800">
          ← Disclosure requests
        </Link>
        <h1 className="mt-1 text-lg font-semibold text-neutral-900">Record a disclosure request</h1>
        <p className="text-sm text-neutral-500">
          A compliance record of who asked, under what authority, what was disclosed, who approved
          it, and whether the user was told.
        </p>
      </div>
      <NewDisclosureForm />
    </div>
  );
}
