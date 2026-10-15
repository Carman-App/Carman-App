"use client";

import Link from "next/link";
import { Menu } from "lucide-react";
import { useState } from "react";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";

const NAV = [
  { href: "/vehicles", label: "Buy a car" },
  { href: "/brokers", label: "Brokers" },
  { href: "/dealers", label: "Dealers" },
  { href: "/sell", label: "Sell your car" },
  { href: "/pricing", label: "Pricing" },
  { href: "/how-it-works", label: "How it works" },
];

export function MobileNav() {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className="rounded-md p-2 text-ink hover:bg-surface md:hidden" aria-label="Open menu">
        <Menu className="size-5" />
      </DialogTrigger>
      <DialogContent title="Menu" side="right">
        <nav className="grid gap-1" aria-label="Mobile">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} onClick={() => setOpen(false)} className="rounded-md px-3 py-3 text-base font-medium hover:bg-surface">
              {n.label}
            </Link>
          ))}
        </nav>
      </DialogContent>
    </Dialog>
  );
}
