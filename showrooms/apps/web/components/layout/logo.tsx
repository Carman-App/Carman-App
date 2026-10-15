import Link from "next/link";
import { cn } from "@/lib/utils";

export function Logo({ className, href = "/" }: { className?: string; href?: string }) {
  return (
    <Link href={href} className={cn("inline-flex items-center gap-2 font-extrabold tracking-tight text-ink", className)} aria-label="Showrooms home">
      <span className="grid size-8 place-items-center rounded-md bg-ink text-white" aria-hidden>
        <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 13l2-5a2 2 0 0 1 1.9-1.4h10.2A2 2 0 0 1 19 8l2 5" />
          <path d="M3 13h18v4a1 1 0 0 1-1 1h-1.5M3 13v4a1 1 0 0 0 1 1h1.5" />
          <circle cx="7.5" cy="17.5" r="1.5" className="text-accent" stroke="#F97316" />
          <circle cx="16.5" cy="17.5" r="1.5" stroke="#F97316" />
        </svg>
      </span>
      <span className="text-lg">Showrooms</span>
    </Link>
  );
}
