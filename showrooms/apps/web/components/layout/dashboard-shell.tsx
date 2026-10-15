"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { Menu } from "lucide-react";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/misc";
import { useAuth } from "@/features/auth/auth-provider";
import { cn } from "@/lib/utils";
import { Logo } from "./logo";
import { UserMenu } from "./user-menu";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: number;
}

function NavLinks({ items, onNavigate }: { items: NavItem[]; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="grid gap-0.5" aria-label="Dashboard">
      {items.map(({ href, label, icon: Icon, badge }) => {
        const active = pathname === href || (href !== "/dashboard" && href !== "/admin" && pathname.startsWith(`${href}/`)) || (pathname === href);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn("flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium", active ? "bg-ink text-white" : "text-ink-muted hover:bg-surface hover:text-ink")}
          >
            <Icon className="size-4" aria-hidden />
            <span className="flex-1">{label}</span>
            {badge ? <span className={cn("rounded-full px-1.5 text-xs font-bold", active ? "bg-white text-ink" : "bg-accent text-white")}>{badge}</span> : null}
          </Link>
        );
      })}
    </nav>
  );
}

/**
 * Authenticated shell. The redirect here is only a convenience: every request
 * the pages make is authorized again by the API.
 */
export function DashboardShell({ items, title, children, allow }: { items: NavItem[]; title: string; children: React.ReactNode; allow?: (role: string) => boolean }) {
  const { status, user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (status === "anonymous") router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    else if (status === "authenticated" && user && allow && !allow(user.role)) router.replace("/dashboard");
  }, [status, user, allow, router, pathname]);

  if (status !== "authenticated" || !user || (allow && !allow(user.role))) {
    return (
      <div className="container-page grid gap-4 py-10">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-surface">
      <header className="sticky top-0 z-40 border-b border-border bg-white">
        <div className="flex h-14 items-center justify-between gap-4 px-4 lg:px-6">
          <div className="flex items-center gap-3">
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger className="rounded-md p-2 hover:bg-surface lg:hidden" aria-label="Open navigation">
                <Menu className="size-5" />
              </DialogTrigger>
              <DialogContent title={title} side="right">
                <NavLinks items={items} onNavigate={() => setOpen(false)} />
              </DialogContent>
            </Dialog>
            <Logo />
            <span className="hidden rounded-md bg-surface px-2 py-0.5 text-xs font-semibold text-ink-muted sm:inline">{title}</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/vehicles" className="hidden text-sm font-medium text-ink-muted hover:text-ink sm:inline">Marketplace</Link>
            <UserMenu />
          </div>
        </div>
      </header>
      <div className="flex">
        <aside className="sticky top-14 hidden h-[calc(100dvh-3.5rem)] w-60 shrink-0 overflow-y-auto border-r border-border bg-white p-3 lg:block">
          <NavLinks items={items} />
        </aside>
        <main id="main" className="min-w-0 flex-1 p-4 lg:p-8">{children}</main>
      </div>
    </div>
  );
}

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-ink-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
