import { titleCase } from "@/lib/format";

export function Badge({ value }: { value: string }) {
  return (
    <span className="inline-flex items-center rounded-full border border-neutral-300 bg-neutral-50 px-2 py-0.5 text-xs text-neutral-700">
      {titleCase(value)}
    </span>
  );
}
