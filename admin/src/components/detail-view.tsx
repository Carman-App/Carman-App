import type { ReactNode } from "react";

export type DetailField = {
  label: string;
  value: ReactNode;
};

/**
 * Generic key/value detail panel, reused across entity detail pages
 * (Account, Garage, Vehicle, Workshop, Job, ...) instead of bespoke UI per
 * type — this admin panel prioritizes every domain area being reachable
 * and correct over deep per-entity editing UI.
 */
export function DetailView({
  title,
  subtitle,
  fields,
}: {
  title: string;
  subtitle?: string;
  fields: DetailField[];
}) {
  return (
    <div className="rounded border border-neutral-800">
      <div className="border-b border-neutral-800 px-4 py-3">
        <h2 className="text-base font-semibold text-neutral-100">{title}</h2>
        {subtitle && <p className="text-sm text-neutral-500">{subtitle}</p>}
      </div>
      <dl className="divide-y divide-neutral-800">
        {fields.map((field) => (
          <div key={field.label} className="grid grid-cols-3 gap-4 px-4 py-3 text-sm">
            <dt className="text-neutral-500">{field.label}</dt>
            <dd className="col-span-2 text-neutral-200">{field.value ?? "—"}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-medium text-neutral-400">{title}</h3>
      {children}
    </section>
  );
}
