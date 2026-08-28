import Link from "next/link";

const TABS: { href: string; label: string; key: TabKey }[] = [
  { href: "/config", label: "Countries", key: "countries" },
  { href: "/config/plans", label: "Plans & prices", key: "plans" },
  { href: "/config/lists", label: "Lists", key: "lists" },
  { href: "/config/vehicle-models", label: "Vehicle models", key: "vehicle-models" },
  { href: "/config/flags", label: "Feature flags", key: "flags" },
  { href: "/config/subscription-rules", label: "Subscription rules", key: "subscription-rules" },
];

type TabKey = "countries" | "plans" | "lists" | "vehicle-models" | "flags" | "subscription-rules";

/**
 * The sidebar only registers a single "/config" nav entry (see
 * src/components/nav-config.ts, not edited by this surface) — this in-page
 * tab strip is the sub-navigation across CFG-01/02/03/04/05/08, matching
 * MessagingTabs' precedent for folding several concerns under one nav entry.
 */
export function ConfigTabs({ active }: { active: TabKey }) {
  return (
    <nav className="flex flex-wrap gap-1 border-b border-neutral-200 pb-2 text-sm">
      {TABS.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          className={
            tab.key === active
              ? "rounded px-3 py-1.5 bg-neutral-200 text-neutral-900"
              : "rounded px-3 py-1.5 text-neutral-600 hover:text-neutral-900"
          }
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
