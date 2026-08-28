import Link from "next/link";
import { PERIOD_OPTIONS, type PeriodDays } from "@/lib/data-quality/period";

/** Row of "last N days" links for the selectable-period pages (DATA-01/02/04/05). Plain GET links — no client JS needed. */
export function PeriodLinks({ basePath, selected }: { basePath: string; selected: PeriodDays }) {
  return (
    <div className="flex flex-wrap gap-1.5 text-xs">
      {PERIOD_OPTIONS.map((days) => (
        <Link
          key={days}
          href={`${basePath}?days=${days}`}
          className={`rounded-full border px-2.5 py-1 ${
            days === selected
              ? "border-neutral-100 bg-neutral-900 text-neutral-100"
              : "border-neutral-300 text-neutral-700 hover:border-neutral-500"
          }`}
        >
          Last {days}d
        </Link>
      ))}
    </div>
  );
}
