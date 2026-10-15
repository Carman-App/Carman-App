"use client";

import { Tabs as T } from "radix-ui";
import { cn } from "@/lib/utils";

export const Tabs = T.Root;
export function TabsList({ className, ...props }: React.ComponentProps<typeof T.List>) {
  return <T.List className={cn("inline-flex gap-1 rounded-lg bg-surface p-1", className)} {...props} />;
}
export function TabsTrigger({ className, ...props }: React.ComponentProps<typeof T.Trigger>) {
  return (
    <T.Trigger
      className={cn("rounded-md px-3 py-1.5 text-sm font-medium text-ink-muted data-[state=active]:bg-white data-[state=active]:text-ink data-[state=active]:shadow-card", className)}
      {...props}
    />
  );
}
export const TabsContent = T.Content;
