"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_SECTIONS } from "./nav-config";
import type { AdminRole } from "@/generated/prisma/enums";

export function SidebarNav({ role }: { role: AdminRole }) {
  const pathname = usePathname();

  return (
    <nav className="space-y-6">
      {NAV_SECTIONS.map((section, i) => {
        const items = section.items.filter((item) => item.roles.includes(role));
        if (items.length === 0) return null;
        return (
          <div key={section.label || i}>
            {section.label && (
              <p className="px-3 text-xs font-semibold uppercase tracking-wider text-neutral-600">
                {section.label}
              </p>
            )}
            <ul className="mt-1 space-y-0.5">
              {items.map((item) => {
                const active =
                  item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={`block rounded px-3 py-1.5 text-sm transition ${
                        active
                          ? "bg-neutral-800 text-neutral-50"
                          : "text-neutral-400 hover:bg-neutral-900 hover:text-neutral-100"
                      }`}
                    >
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}
