import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { DataTable } from "@/components/data-table";
import { Badge } from "@/components/badge";
import { formatDate } from "@/lib/format";
import { requireRole, ACCOUNTS_ROLES } from "@/lib/auth/rbac";

export const dynamic = "force-dynamic";

// ACCT-01: universal search. There is no separate omnibox elsewhere in
// Phase One — this page IS the universal search surface. Every result kind
// (Account / Garage / Vehicle / Invoice) ultimately resolves to and links to
// an Account detail page, since that's the one place an operator needs to
// end up.
type ResultKind = "Account" | "Garage" | "Vehicle" | "Invoice";

type SearchResult = {
  id: string; // unique key for the table row (kind-prefixed)
  kind: ResultKind;
  matchedField: string;
  name: string;
  email: string;
  accountId: string;
};

const KIND_COLORS: Record<ResultKind, string> = {
  Account: "border-sky-800 bg-sky-950/40 text-sky-300",
  Garage: "border-amber-800 bg-amber-950/40 text-amber-300",
  Vehicle: "border-violet-800 bg-violet-950/40 text-violet-300",
  Invoice: "border-emerald-800 bg-emerald-950/40 text-emerald-300",
};

function KindLabel({ kind }: { kind: ResultKind }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${KIND_COLORS[kind]}`}
    >
      {kind}
    </span>
  );
}

async function searchEverything(q: string): Promise<SearchResult[]> {
  const results: SearchResult[] = [];

  const accounts = await prisma.account.findMany({
    where: {
      OR: [
        { id: { contains: q, mode: "insensitive" } },
        { user: { name: { contains: q, mode: "insensitive" } } },
        { user: { email: { contains: q, mode: "insensitive" } } },
      ],
    },
    include: { user: true },
    take: 20,
  });
  for (const a of accounts) {
    const matchedOn = a.id.toLowerCase().includes(q.toLowerCase())
      ? `Account id: ${a.id}`
      : a.user.email.toLowerCase().includes(q.toLowerCase())
        ? `Email: ${a.user.email}`
        : `Name: ${a.user.name}`;
    results.push({
      id: `account:${a.id}`,
      kind: "Account",
      matchedField: matchedOn,
      name: a.user.name,
      email: a.user.email,
      accountId: a.id,
    });
  }

  const garages = await prisma.garage.findMany({
    where: { name: { contains: q, mode: "insensitive" } },
    include: { owner: { include: { user: true } } },
    take: 20,
  });
  for (const g of garages) {
    results.push({
      id: `garage:${g.id}`,
      kind: "Garage",
      matchedField: `Garage name: ${g.name}`,
      name: g.owner.user.name,
      email: g.owner.user.email,
      accountId: g.ownerId,
    });
  }

  const vehicles = await prisma.vehicle.findMany({
    where: { plate: { contains: q, mode: "insensitive" } },
    include: { garage: { include: { owner: { include: { user: true } } } } },
    take: 20,
  });
  for (const v of vehicles) {
    results.push({
      id: `vehicle:${v.id}`,
      kind: "Vehicle",
      matchedField: `Plate: ${v.plate}`,
      name: v.garage.owner.user.name,
      email: v.garage.owner.user.email,
      accountId: v.garage.ownerId,
    });
  }

  const invoices = await prisma.invoice.findMany({
    where: { id: { contains: q, mode: "insensitive" } },
    include: { vehicle: { include: { garage: { include: { owner: { include: { user: true } } } } } } },
    take: 20,
  });
  for (const inv of invoices) {
    results.push({
      id: `invoice:${inv.id}`,
      kind: "Invoice",
      matchedField: `Invoice id: ${inv.id}`,
      name: inv.vehicle.garage.owner.user.name,
      email: inv.vehicle.garage.owner.user.email,
      accountId: inv.vehicle.garage.ownerId,
    });
  }

  return results;
}

async function getRecentAccounts() {
  return prisma.account.findMany({
    include: { user: true, profiles: true },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
}

export default async function AccountsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requireRole(ACCOUNTS_ROLES);
  const { q } = await searchParams;
  const query = (q ?? "").trim();

  const results = query.length > 0 ? await searchEverything(query) : null;
  const recentAccounts = results === null ? await getRecentAccounts() : null;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-neutral-100">Accounts</h1>
          <p className="text-sm text-neutral-500">
            Universal search — account name/email/id, garage name, vehicle plate, or invoice id.
            Every result links to the owning account.
          </p>
        </div>
        <Link
          href="/accounts/no-vehicle"
          className="whitespace-nowrap rounded border border-neutral-700 px-3 py-1.5 text-sm text-neutral-300 hover:border-neutral-500"
        >
          Signed up, no vehicle →
        </Link>
      </div>

      <form className="space-y-1">
        <input
          type="search"
          name="q"
          defaultValue={query}
          placeholder="Search by name, email, account id, garage name, plate, or invoice id…"
          className="w-full rounded border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100"
        />
        <p className="text-xs text-neutral-600">
          Invoices don&rsquo;t have a human-readable number yet, only an internal id — search
          matches that id. Phone isn&rsquo;t tracked in this product yet — search can&rsquo;t match
          it.
        </p>
      </form>

      {results !== null ? (
        <DataTable
          rows={results}
          href={(row) => `/accounts/${row.accountId}`}
          emptyLabel={`No matches for "${query}" across accounts, garages, vehicles, or invoices.`}
          columns={[
            { header: "Type", cell: (row) => <KindLabel kind={row.kind} /> },
            { header: "Matched on", cell: (row) => row.matchedField },
            { header: "Account", cell: (row) => row.name },
            { header: "Email", cell: (row) => row.email },
          ]}
        />
      ) : (
        <DataTable
          rows={recentAccounts ?? []}
          href={(row) => `/accounts/${row.id}`}
          emptyLabel="No accounts yet. They're created when someone signs up in the mobile app."
          columns={[
            { header: "Name", cell: (row) => row.user.name },
            { header: "Email", cell: (row) => row.user.email },
            { header: "Region", cell: (row) => row.region },
            {
              header: "Profiles",
              cell: (row) => (
                <div className="flex gap-1">
                  {row.profiles.length === 0 && "—"}
                  {row.profiles.map((p) => (
                    <Badge key={p.id} value={p.type} />
                  ))}
                </div>
              ),
            },
            { header: "Joined", cell: (row) => formatDate(row.createdAt) },
          ]}
        />
      )}
    </div>
  );
}
