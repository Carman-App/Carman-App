import Link from "next/link";

const LINKS: { href: string; label: string }[] = [
  { href: "/privacy", label: "Data export (PRIV-01)" },
  { href: "/privacy/consent", label: "Consent history (PRIV-03)" },
  { href: "/privacy/retention", label: "Retention windows (PRIV-04)" },
];

/** Shared sub-nav across every Privacy page — see AGENTS.md's PRIV-01..05. */
export function PrivacyNav({ active }: { active: string }) {
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
