import { AlertTriangle, Inbox, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("animate-pulse rounded-md bg-surface", className)} aria-hidden {...props} />;
}

export function EmptyState({ title, description, action, icon }: { title: string; description?: string; action?: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border px-6 py-12 text-center">
      <div className="rounded-full bg-surface p-3 text-ink-muted">{icon ?? <Inbox className="size-6" />}</div>
      <div>
        <p className="font-semibold text-ink">{title}</p>
        {description && <p className="mt-1 max-w-sm text-sm text-ink-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center gap-3 rounded-lg border border-danger/20 bg-danger-soft px-6 py-10 text-center">
      <AlertTriangle className="size-6 text-danger" />
      <p className="text-sm text-ink">{message}</p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RefreshCw /> Try again
        </Button>
      )}
    </div>
  );
}

export function Separator({ className }: { className?: string }) {
  return <hr className={cn("border-border", className)} />;
}

export function Stat({ label, value, hint, className }: { label: string; value: React.ReactNode; hint?: string; className?: string }) {
  return (
    <div className={cn("rounded-lg border border-border bg-white p-4 shadow-card", className)}>
      <p className="text-xs font-medium tracking-wide text-ink-muted uppercase">{label}</p>
      <p className="tabular mt-1 text-2xl font-bold text-ink">{value}</p>
      {hint && <p className="mt-1 text-xs text-ink-subtle">{hint}</p>}
    </div>
  );
}

export function Pagination({ page, totalPages, onPage, hrefFor }: { page: number; totalPages: number; onPage?: (p: number) => void; hrefFor?: (p: number) => string }) {
  if (totalPages <= 1) return null;
  // Link mode is server-rendered (no handlers); button mode is for client lists.
  const item = (p: number, label: string, disabled: boolean) =>
    hrefFor ? (
      disabled ? (
        <span className="rounded-md border border-border px-3 py-1.5 text-sm text-ink-subtle" aria-disabled="true">{label}</span>
      ) : (
        <a href={hrefFor(p)} className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-surface" aria-label={`${label} page`}>
          {label}
        </a>
      )
    ) : (
      <Button variant="outline" size="sm" disabled={disabled} onClick={() => onPage?.(p)}>
        {label}
      </Button>
    );
  return (
    <nav className="flex items-center justify-center gap-3 py-6" aria-label="Pagination">
      {item(page - 1, "Previous", page <= 1)}
      <span className="text-sm text-ink-muted tabular">
        Page {page} of {totalPages}
      </span>
      {item(page + 1, "Next", page >= totalPages)}
    </nav>
  );
}
