import Link from "next/link";

const TABS = [
  { href: "/messaging", label: "Campaigns" },
  { href: "/messaging/templates", label: "Templates" },
  { href: "/messaging/whats-new", label: "What's new" },
  { href: "/messaging/banners", label: "Banners" },
];

/**
 * The sidebar only registers a single "/messaging" nav entry (see
 * src/components/nav-config.ts) — this in-page tab strip is the
 * sub-navigation between the four Messaging surfaces, matching how other
 * Phase Two areas fold multiple concerns under one nav entry.
 */
export function MessagingTabs({ active }: { active: "campaigns" | "templates" | "whats-new" | "banners" }) {
  const activeHref =
    active === "campaigns"
      ? "/messaging"
      : active === "templates"
        ? "/messaging/templates"
        : active === "whats-new"
          ? "/messaging/whats-new"
          : "/messaging/banners";

  return (
    <nav className="flex gap-1 border-b border-neutral-200 pb-2 text-sm">
      {TABS.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          className={
            tab.href === activeHref
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
