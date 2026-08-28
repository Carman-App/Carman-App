import Link from "next/link";

const LINKS: { href: string; label: string }[] = [
  { href: "/billing", label: "Overview (MRR)" },
  { href: "/billing/trials", label: "Trial cohorts" },
  { href: "/billing/failed-payments", label: "Failed payments" },
  { href: "/billing/dunning", label: "Dunning" },
  { href: "/billing/cancellations", label: "Cancellations" },
  { href: "/billing/refunds", label: "Refunds & credits" },
  { href: "/billing/grant-free-period", label: "Extend trial / free period" },
  { href: "/billing/revenue", label: "Revenue by region" },
  { href: "/billing/export", label: "Accountant export" },
];

/** Shared sub-nav across every Money page — see AGENTS.md's MON-01..10. */
export function BillingNav({ active }: { active: string }) {
  return (
    <nav className="flex flex-wrap gap-2 border-b border-neutral-200 pb-3 text-sm">
      {LINKS.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          className={`rounded px-2 py-1 ${
            l.href === active
              ? "bg-neutral-200 text-neutral-900"
              : "text-neutral-600 hover:bg-neutral-50 hover:text-neutral-800"
          }`}
        >
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
