import Link from "next/link";
import { formatDate } from "@/lib/format";
import { requireRole, GARAGE_ROLES } from "@/lib/auth/rbac";
import { findDuplicatePlates } from "@/lib/garages/duplicate-plates";
import { REGION_LABELS } from "@/lib/region";

export const dynamic = "force-dynamic";

// GAR-05: plates that appear on more than one vehicle, across more than one
// garage, within the same country.

export default async function DuplicatePlatesPage() {
  await requireRole(GARAGE_ROLES);
  const groups = await findDuplicatePlates();

  return (
    <div className="space-y-4">
      <div>
        <Link href="/garages" className="text-sm text-neutral-500 hover:text-neutral-800">
          ← Garages
        </Link>
        <h1 className="mt-1 text-lg font-semibold text-neutral-900">Duplicate plates</h1>
        <p className="text-sm text-neutral-500">
          Same plate on file for more than one vehicle in different garages, scoped to the same
          country (an account&rsquo;s region). There is no explicit &ldquo;claimed this plate&rdquo;
          event anywhere in the schema, so each vehicle&rsquo;s own creation date is shown as an
          honest proxy for a claim date, not a real one.
        </p>
      </div>

      {groups.length === 0 ? (
        <div className="rounded border border-dashed border-neutral-200 p-8 text-center text-sm text-neutral-500">
          No duplicate plates found across any garage.
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map((group) => (
            <section key={`${group.region}::${group.plate}`} className="rounded border border-amber-200">
              <div className="border-b border-amber-200 bg-amber-50 px-4 py-2">
                <span className="font-mono text-sm text-amber-800">{group.plate}</span>
                <span className="ml-2 text-xs text-neutral-500">
                  {REGION_LABELS[group.region]} · {group.vehicles.length} vehicles across{" "}
                  {new Set(group.vehicles.map((v) => v.garageId)).size} garages
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-max text-left text-sm">
                  <thead className="bg-neutral-50 text-neutral-600">
                    <tr>
                      <th className="whitespace-nowrap px-4 py-2 font-medium">Vehicle</th>
                      <th className="whitespace-nowrap px-4 py-2 font-medium">Garage</th>
                      <th className="whitespace-nowrap px-4 py-2 font-medium">Owner</th>
                      <th className="whitespace-nowrap px-4 py-2 font-medium">Records</th>
                      <th className="whitespace-nowrap px-4 py-2 font-medium">Claim date (proxy)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200">
                    {group.vehicles.map((v) => (
                      <tr key={v.id} className="hover:bg-neutral-100">
                        <td className="whitespace-nowrap px-4 py-2">
                          <Link href={`/vehicles/${v.id}`} className="hover:underline">
                            {v.year} {v.make} {v.model}
                          </Link>
                        </td>
                        <td className="whitespace-nowrap px-4 py-2">
                          <Link href={`/garages/${v.garageId}`} className="hover:underline">
                            {v.garageName}
                          </Link>
                        </td>
                        <td className="whitespace-nowrap px-4 py-2">
                          <Link href={`/accounts/${v.ownerAccountId}`} className="hover:underline">
                            {v.ownerName}
                          </Link>
                        </td>
                        <td className="whitespace-nowrap px-4 py-2">{v.recordCount}</td>
                        <td className="whitespace-nowrap px-4 py-2">{formatDate(v.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
