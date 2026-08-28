import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireRole, ACCOUNTS_ROLES, canRunAccountQuickAction } from "@/lib/auth/rbac";
import { formatDate, formatDateTime } from "@/lib/format";
import { Region } from "@/generated/prisma/enums";
import { REGION_LABELS } from "@/lib/region";
import { buildNoVehicleWhere } from "@/lib/accounts/no-vehicle";
import { markChasedNoVehicle } from "./actions";

export const dynamic = "force-dynamic";

type SearchParams = {
  minAgeDays?: string;
  region?: string;
  includeChased?: string;
};

export default async function NoVehicleAccountsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await requireRole(ACCOUNTS_ROLES);
  const sp = await searchParams;

  const minAgeDays = sp.minAgeDays ? Number(sp.minAgeDays) : undefined;
  const region = sp.region && sp.region in Region ? (sp.region as Region) : undefined;
  const includeChased = sp.includeChased === "1";

  const where = buildNoVehicleWhere({ minAgeDays, region, includeChased });
  const accounts = await prisma.account.findMany({
    where,
    include: { user: true },
    orderBy: { createdAt: "asc" },
    take: 500,
  });

  const exportQs = new URLSearchParams({
    ...(minAgeDays ? { minAgeDays: String(minAgeDays) } : {}),
    ...(region ? { region } : {}),
    ...(includeChased ? { includeChased: "1" } : {}),
  }).toString();

  return (
    <div className="space-y-4">
      <div>
        <Link href="/accounts" className="text-sm text-neutral-500 hover:text-neutral-200">
          ← Accounts
        </Link>
        <h1 className="mt-1 text-lg font-semibold text-neutral-100">Signed up, no vehicle</h1>
        <p className="text-sm text-neutral-500">
          ACCT-04: accounts that own no garage with a vehicle in it, and hold no vehicle-level
          membership either. Mark a row &ldquo;chased&rdquo; once followed up so nobody chases the
          same account twice.
        </p>
      </div>

      <form className="flex flex-wrap items-end gap-3 rounded border border-neutral-800 p-4">
        <div>
          <label className="block text-xs text-neutral-500">Signed up at least (days ago)</label>
          <input
            type="number"
            min={0}
            name="minAgeDays"
            defaultValue={sp.minAgeDays}
            placeholder="e.g. 7"
            className="mt-1 w-32 rounded border border-neutral-700 bg-neutral-950 px-2 py-1 text-sm text-neutral-100"
          />
        </div>
        <div>
          <label className="block text-xs text-neutral-500">Region</label>
          <select
            name="region"
            defaultValue={sp.region ?? ""}
            className="mt-1 rounded border border-neutral-700 bg-neutral-950 px-2 py-1 text-sm text-neutral-100"
          >
            <option value="">Any</option>
            {Object.values(Region).map((r) => (
              <option key={r} value={r}>
                {REGION_LABELS[r]}
              </option>
            ))}
          </select>
        </div>
        <label className="flex items-center gap-2 pb-1 text-sm text-neutral-300">
          <input type="checkbox" name="includeChased" value="1" defaultChecked={includeChased} />
          Include already-chased
        </label>
        <button
          type="submit"
          className="rounded bg-neutral-100 px-3 py-1.5 text-sm font-medium text-neutral-900 hover:bg-white"
        >
          Filter
        </button>
        <Link
          href={`/api/admin/accounts/no-vehicle-export${exportQs ? `?${exportQs}` : ""}`}
          className="rounded border border-neutral-700 px-3 py-1.5 text-sm text-neutral-300 hover:border-neutral-500"
        >
          Export CSV
        </Link>
      </form>

      <div className="overflow-x-auto rounded border border-neutral-800">
        <table className="w-full min-w-max text-left text-sm">
          <thead className="bg-neutral-900 text-neutral-400">
            <tr>
              <th className="whitespace-nowrap px-4 py-2 font-medium">Name</th>
              <th className="whitespace-nowrap px-4 py-2 font-medium">Email</th>
              <th className="whitespace-nowrap px-4 py-2 font-medium">Region</th>
              <th className="whitespace-nowrap px-4 py-2 font-medium">Signed up</th>
              <th className="whitespace-nowrap px-4 py-2 font-medium">Chased</th>
              <th className="whitespace-nowrap px-4 py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-800">
            {accounts.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-neutral-500">
                  No accounts match this filter.
                </td>
              </tr>
            )}
            {accounts.map((a) => (
              <tr key={a.id} className={a.chasedNoVehicleAt ? "opacity-50" : "hover:bg-neutral-900/60"}>
                <td className="whitespace-nowrap px-4 py-2">
                  <Link href={`/accounts/${a.id}`} className="hover:underline">
                    {a.user.name}
                  </Link>
                </td>
                <td className="whitespace-nowrap px-4 py-2">{a.user.email}</td>
                <td className="whitespace-nowrap px-4 py-2">{a.region}</td>
                <td className="whitespace-nowrap px-4 py-2">{formatDate(a.createdAt)}</td>
                <td className="whitespace-nowrap px-4 py-2">
                  {a.chasedNoVehicleAt ? (
                    <span className="text-neutral-400" title={formatDateTime(a.chasedNoVehicleAt)}>
                      Chased {formatDate(a.chasedNoVehicleAt)}
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="whitespace-nowrap px-4 py-2">
                  {!a.chasedNoVehicleAt && canRunAccountQuickAction(session.role) && (
                    <form action={markChasedNoVehicle}>
                      <input type="hidden" name="accountId" value={a.id} />
                      <button type="submit" className="text-xs text-neutral-300 hover:underline">
                        Mark chased
                      </button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
