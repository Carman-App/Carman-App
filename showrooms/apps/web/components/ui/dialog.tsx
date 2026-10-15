"use client";

import { Dialog as D } from "radix-ui";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export const Dialog = D.Root;
export const DialogTrigger = D.Trigger;
export const DialogClose = D.Close;

export function DialogContent({ className, children, title, description, side, ...props }: React.ComponentProps<typeof D.Content> & { title: string; description?: string; side?: "center" | "right" }) {
  return (
    <D.Portal>
      <D.Overlay className="fixed inset-0 z-50 bg-ink/40 data-[state=open]:animate-in" />
      <D.Content
        className={cn(
          "fixed z-50 flex max-h-[92dvh] flex-col overflow-hidden bg-white shadow-raised focus:outline-none",
          side === "right"
            ? "inset-y-0 right-0 w-full max-w-md"
            : "inset-x-0 bottom-0 rounded-t-xl sm:inset-auto sm:top-1/2 sm:left-1/2 sm:w-full sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl",
          className,
        )}
        {...props}
      >
        <div className="flex items-start justify-between gap-4 border-b border-border p-5">
          <div>
            <D.Title className="text-lg font-semibold text-ink">{title}</D.Title>
            {description ? <D.Description className="mt-1 text-sm text-ink-muted">{description}</D.Description> : <D.Description className="sr-only">{title}</D.Description>}
          </div>
          <D.Close className="rounded-md p-1 text-ink-muted hover:bg-surface" aria-label="Close">
            <X className="size-5" />
          </D.Close>
        </div>
        <div className="overflow-y-auto p-5">{children}</div>
      </D.Content>
    </D.Portal>
  );
}
