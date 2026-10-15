"use client";

import { BarChart3, Bell, Car, CreditCard, Gem, Heart, Inbox, LayoutDashboard, PlusCircle, Settings, Store, Users } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { DashboardShell, type NavItem } from "@/components/layout/dashboard-shell";
import { isSeller, useAuth } from "@/features/auth/auth-provider";
import { api } from "@/lib/api-client";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const unread = useQuery({ queryKey: ["notifications", "unread"], queryFn: () => api<{ unread: number }>("/notifications/unread-count"), enabled: !!user, refetchInterval: 60_000 });
  const seller = isSeller(user);
  const items: NavItem[] = [
    { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
    ...(seller
      ? [
          { href: "/dashboard/vehicles", label: "My vehicles", icon: Car },
          { href: "/dashboard/vehicles/new", label: "Add vehicle", icon: PlusCircle },
          { href: "/dashboard/inquiries", label: "Leads", icon: Inbox },
          { href: "/dashboard/analytics", label: "Analytics", icon: BarChart3 },
          { href: "/dashboard/profile", label: user?.role === "DEALER" ? "Dealership" : "Broker profile", icon: Store },
          ...(user?.role === "DEALER" ? [{ href: "/dashboard/team", label: "Team", icon: Users }] : []),
          { href: "/dashboard/subscription", label: "Subscription", icon: Gem },
          { href: "/dashboard/payments", label: "Payments", icon: CreditCard },
        ]
      : [{ href: "/dashboard/inquiries", label: "My inquiries", icon: Inbox }]),
    { href: "/dashboard/saved", label: "Saved", icon: Heart },
    { href: "/dashboard/notifications", label: "Notifications", icon: Bell, badge: unread.data?.unread },
    { href: "/dashboard/settings", label: "Account", icon: Settings },
  ];
  return (
    <DashboardShell items={items} title={seller ? "Seller dashboard" : "My account"}>
      {children}
    </DashboardShell>
  );
}
