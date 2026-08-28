import Link from "next/link";
import { requireRole, SUPPORT_ROLES } from "@/lib/auth/rbac";
import { NewTicketForm } from "./new-ticket-form";

export const dynamic = "force-dynamic";

export default async function NewTicketPage() {
  await requireRole(SUPPORT_ROLES);

  return (
    <div className="max-w-xl space-y-4">
      <div>
        <Link href="/support" className="text-sm text-neutral-500 hover:text-neutral-800">
          ← Ticket queue
        </Link>
        <h1 className="mt-1 text-lg font-semibold text-neutral-900">Log a ticket</h1>
        <p className="text-sm text-neutral-500">
          For contact that came in over phone, email, SMS, or WhatsApp — there is no in-app
          &ldquo;contact support&rdquo; flow yet, so an admin logs it here. The account&rsquo;s
          country, plan, and current payment state are attached automatically.
        </p>
      </div>
      <NewTicketForm />
    </div>
  );
}
