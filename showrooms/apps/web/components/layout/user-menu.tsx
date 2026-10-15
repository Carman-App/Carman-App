"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { DropdownMenu } from "radix-ui";
import { Bell, Car, Heart, LayoutDashboard, LogOut, Settings, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/misc";
import { isSeller, useAuth } from "@/features/auth/auth-provider";

export function UserMenu() {
  const { status, user, signOut } = useAuth();
  const router = useRouter();

  if (status === "loading") return <Skeleton className="h-9 w-24" />;
  if (!user) {
    return (
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/login">Log in</Link>
        </Button>
        <Button size="sm" asChild className="hidden sm:inline-flex">
          <Link href="/register?role=BROKER">Start selling</Link>
        </Button>
      </div>
    );
  }

  const initials = user.name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  const item = "flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm text-ink outline-none data-[highlighted]:bg-surface [&_svg]:size-4 [&_svg]:text-ink-muted";
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger className="flex items-center gap-2 rounded-full border border-border py-1 pr-3 pl-1 text-sm font-medium hover:bg-surface" aria-label="Account menu">
        <span className="grid size-7 place-items-center rounded-full bg-ink text-xs font-bold text-white">{initials}</span>
        <span className="hidden max-w-32 truncate sm:inline">{user.name.split(" ")[0]}</span>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="end" sideOffset={8} className="z-50 min-w-52 rounded-lg border border-border bg-white p-1 shadow-raised">
          <div className="px-2 py-2">
            <p className="truncate text-sm font-semibold">{user.name}</p>
            <p className="truncate text-xs text-ink-muted">{user.email}</p>
          </div>
          <DropdownMenu.Separator className="my-1 h-px bg-border" />
          {user.role === "ADMIN" && (
            <DropdownMenu.Item className={item} onSelect={() => router.push("/admin")}>
              <Shield /> Admin
            </DropdownMenu.Item>
          )}
          <DropdownMenu.Item className={item} onSelect={() => router.push("/dashboard")}>
            <LayoutDashboard /> Dashboard
          </DropdownMenu.Item>
          {isSeller(user) && (
            <DropdownMenu.Item className={item} onSelect={() => router.push("/dashboard/vehicles")}>
              <Car /> My vehicles
            </DropdownMenu.Item>
          )}
          <DropdownMenu.Item className={item} onSelect={() => router.push("/dashboard/saved")}>
            <Heart /> Saved
          </DropdownMenu.Item>
          <DropdownMenu.Item className={item} onSelect={() => router.push("/dashboard/notifications")}>
            <Bell /> Notifications
          </DropdownMenu.Item>
          <DropdownMenu.Item className={item} onSelect={() => router.push("/dashboard/settings")}>
            <Settings /> Settings
          </DropdownMenu.Item>
          <DropdownMenu.Separator className="my-1 h-px bg-border" />
          <DropdownMenu.Item
            className={item}
            onSelect={async () => {
              await signOut();
              router.push("/");
            }}
          >
            <LogOut /> Log out
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
