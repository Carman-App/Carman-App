import Link from "next/link";

const LINKS: { href: string; label: string }[] = [
  { href: "/growth", label: "Funnel" },
  { href: "/growth/signup-source", label: "Signup source" },
  { href: "/growth/retention", label: "Retention" },
  { href: "/growth/invites", label: "Invites" },
  { href: "/growth/mechanic-attach", label: "Mechanic attach" },
  { href: "/growth/adoption", label: "Feature adoption" },
  { href: "/growth/geography", label: "Geography" },
  { href: "/growth/engaged", label: "Most engaged" },
];

/** Shared sub-nav across every Growth page — see AGENTS.md's GROW-01..08. */
export function GrowthNav({ active }: { active: string }) {
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
