import Link from "next/link";
import { requireRole, GARAGE_ROLES } from "@/lib/auth/rbac";
import { getFlaggedVehiclesPlatformWide, MAX_PLAUSIBLE_KM_PER_DAY, type OdometerFlag } from "@/lib/garages/odometer-flags";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

function flagSummary(flag: OdometerFlag): string {
  switch (flag.type) {
    case "ROLLBACK":
      return `Rollback: ${flag.odometerKm.toLocaleString()} km on ${formatDate(flag.date)} is lower than ${flag.previousOdometerKm.toLocaleString()} km on ${formatDate(flag.previousDate)}`;
    case "IMPLAUSIBLE_JUMP":
      return `Implausible jump: ${Math.round(flag.kmPerDay).toLocaleString()} km/day between ${formatDate(flag.previousDate)} and ${formatDate(flag.date)} (limit ${MAX_PLAUSIBLE_KM_PER_DAY.toLocaleString()} km/day)`;
    case "DUPLICATE":
      return `Duplicate: ${flag.odometerKm.toLocaleString()} km logged again on ${formatDate(flag.date)}, already logged on ${formatDate(flag.duplicateOfDate)}`;
  }
}

export default async function OdometerFlagsPage() {
  await requireRole(GARAGE_ROLES);
  const flagged = await getFlaggedVehiclesPlatformWide();
  const totalFlags = flagged.reduce((sum, f) => sum + f.flags.length, 0);

  return (
    <div className="space-y-4">
      <div>
        <Link href="/vehicles" className="text-sm text-neutral-500 hover:text-neutral-800">
          ← Vehicles
        </Link>
        <h1 className="mt-1 text-lg font-semibold text-neutral-900">Odometer flags</h1>
        <p className="text-sm text-neutral-500">
          Every vehicle platform-wide with an implausible odometer trail — a rollback, a jump
          beyond {MAX_PLAUSIBLE_KM_PER_DAY.toLocaleString()} km/day, or a duplicate reading. Flag
          only: the console never edits or corrects a reading here or anywhere else.
        </p>
      </div>

      <p className="text-sm text-neutral-600">
        {flagged.length} vehicle{flagged.length === 1 ? "" : "s"} flagged, {totalFlags} flag
        {totalFlags === 1 ? "" : "s"} total.
      </p>

      {flagged.length === 0 ? (
        <div className="rounded border border-dashed border-neutral-200 p-8 text-center text-sm text-neutral-500">
          No implausible odometer trails found.
        </div>
      ) : (
        <div className="space-y-4">
          {flagged.map(({ vehicle, flags }) => (
            <section key={vehicle.id} className="rounded border border-amber-200">
              <div className="flex items-center justify-between border-b border-amber-200 bg-amber-50 px-4 py-2">
                <Link href={`/vehicles/${vehicle.id}`} className="text-sm text-amber-800 hover:underline">
                  {vehicle.year} {vehicle.make} {vehicle.model} — {vehicle.plate}
                </Link>
                <span className="text-xs text-neutral-500">
                  <Link href={`/garages/${vehicle.garageId}`} className="hover:underline">
                    {vehicle.garageName}
                  </Link>{" "}
                  ·{" "}
                  <Link href={`/accounts/${vehicle.ownerAccountId}`} className="hover:underline">
                    {vehicle.ownerName}
                  </Link>
                </span>
              </div>
              <ul className="divide-y divide-neutral-200 text-sm">
                {flags.map((flag, i) => (
                  <li key={i} className="px-4 py-2 text-neutral-700">
                    {flagSummary(flag)}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
