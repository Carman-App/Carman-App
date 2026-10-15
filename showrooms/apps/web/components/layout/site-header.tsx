import Link from "next/link";
import { Logo } from "./logo";
import { MobileNav } from "./mobile-nav";
import { UserMenu } from "./user-menu";

export const PUBLIC_NAV = [
  { href: "/vehicles", label: "Buy a car" },
  { href: "/brokers", label: "Brokers" },
  { href: "/dealers", label: "Dealers" },
  { href: "/sell", label: "Sell" },
  { href: "/pricing", label: "Pricing" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/85">
      <div className="container-page flex h-16 items-center justify-between gap-4">
        <div className="flex items-center gap-8">
          <Logo />
          <nav className="hidden items-center gap-6 md:flex" aria-label="Main">
            {PUBLIC_NAV.map((n) => (
              <Link key={n.href} href={n.href} className="text-sm font-medium text-ink-muted hover:text-ink">
                {n.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <UserMenu />
          <MobileNav />
        </div>
      </div>
    </header>
  );
}
