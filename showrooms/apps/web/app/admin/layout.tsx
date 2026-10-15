"use client";

import { BarChart3, Building2, CarFront, ClipboardCheck, CreditCard, Flag, Gem, LayoutDashboard, ListTree, ScrollText, Settings, ShieldCheck, Store, Users } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { AdminOverview } from "@showrooms/shared";
import { DashboardShell, type NavItem } from "@/components/layout/dashboard-shell";
import { useAuth } from "@/features/auth/auth-provider";
import { api } from "@/lib/api-client";

const isAdmin = (role: string) => role === "ADMIN";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const counts = useQuery({ queryKey: ["admin", "overview", 7], queryFn: () => api<AdminOverview>("/admin/overview?days=7"), enabled: user?.role === "ADMIN", refetchInterval: 60_000 });
  const t = counts.data?.totals;
  const items: NavItem[] = [
    { href: "/admin", label: "Overview", icon: LayoutDashboard },
    { href: "/admin/vehicles/pending", label: "Pending listings", icon: ClipboardCheck, badge: t?.pendingListings },
    { href: "/admin/vehicles", label: "All vehicles", icon: CarFront },
    { href: "/admin/verifications", label: "Verifications", icon: ShieldCheck, badge: t?.pendingVerifications },
    { href: "/admin/reports", label: "Reports", icon: Flag, badge: t?.openReports },
    { href: "/admin/users", label: "Users", icon: Users },
    { href: "/admin/brokers", label: "Brokers", icon: Store },
    { href: "/admin/dealers", label: "Dealers", icon: Building2 },
    { href: "/admin/payments", label: "Payments", icon: CreditCard },
    { href: "/admin/subscriptions", label: "Subscriptions", icon: Gem },
    { href: "/admin/categories", label: "Categories", icon: ListTree },
    { href: "/admin/analytics", label: "Analytics", icon: BarChart3 },
    { href: "/admin/audit-logs", label: "Audit logs", icon: ScrollText },
    { href: "/admin/settings", label: "Settings", icon: Settings },
  ];
  return (
    <DashboardShell items={items} title="Admin" allow={isAdmin}>
      {children}
    </DashboardShell>
  );
}
