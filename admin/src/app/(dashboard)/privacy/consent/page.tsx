import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Section } from "@/components/detail-view";
import { DataTable } from "@/components/data-table";
import { Badge } from "@/components/badge";
import { formatDateTime } from "@/lib/format";
import { requireRole, PRIVACY_ROLES } from "@/lib/auth/rbac";
import { PrivacyNav } from "../privacy-nav";
import type { Prisma } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

type SearchParams = { accountId?: string; purpose?: string };

export default async function ConsentPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireRole(PRIVACY_ROLES);
  const sp = await searchParams;

  const where: Prisma.PrivacyConsentWhereInput = {};
  if (sp.accountId) where.accountId = sp.accountId;
  if (sp.purpose) where.purpose = sp.purpose;

  const [consents, account, purposes] = await Promise.all([
    prisma.privacyConsent.findMany({ where, orderBy: { capturedAt: "desc" }, take: 200 }),
    sp.accountId ? prisma.account.findUnique({ where: { id: sp.accountId }, include: { user: true } }) : null,
    prisma.privacyConsent.findMany({ distinct: ["purpose"], select: { purpose: true } }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-neutral-900">Consent history (PRIV-03)</h1>
        <p className="text-sm text-neutral-500">
          Per-account consent history over <code>PrivacyConsent</code> — purpose, whether granted,
          the terms version in effect, when it was captured, and its source.
        </p>
      </div>

      <PrivacyNav active="/privacy/consent" />

      <div className="rounded border border-dashed border-neutral-200 p-4 text-sm text-amber-600">
        <p className="font-medium">Real gap: this table is empty, and will stay empty.</p>
        <p className="mt-1 text-neutral-600">
          There is no consent-capture mechanism anywhere in the mobile app today — onboarding shows
          static &ldquo;you agree to...&rdquo; text with nothing recorded, and this admin build does
          not touch the mobile app to add one. This page is a real, working viewer over the real
          schema (filterable by account and purpose, with the full history/change-log below) that
          will show real rows the moment mobile onboarding is changed to POST into{" "}
          <code>PrivacyConsent</code> — nothing here is fabricated to look populated.
        </p>
      </div>

      <form className="flex flex-wrap items-end gap-3 rounded border border-neutral-200 p-4">
        <div>
          <label className="block text-xs text-neutral-500">Account id</label>
          <input
            name="accountId"
            defaultValue={sp.accountId}
            className="mt-1 rounded border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900"
          />
        </div>
        <div>
          <label className="block text-xs text-neutral-500">Purpose</label>
          <input
            name="purpose"
            defaultValue={sp.purpose}
            placeholder="e.g. marketing"
            list="known-purposes"
            className="mt-1 rounded border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900"
          />
          <datalist id="known-purposes">
            {purposes.map((p) => (
              <option key={p.purpose} value={p.purpose} />
            ))}
          </datalist>
        </div>
        <button type="submit" className="rounded-full bg-carma-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-carma-700">
          Filter
        </button>
      </form>

      {account && (
        <p className="text-sm text-neutral-600">
          Showing consent history for{" "}
          <Link href={`/accounts/${account.id}`} className="hover:underline">
            {account.user.name} ({account.user.email})
          </Link>
          .
        </p>
      )}

      <Section title="History / change-log">
        <DataTable
          rows={consents}
          emptyLabel="No consent rows on file — expected today, see the gap noted above."
          columns={[
            { header: "Account", cell: (r) => <Link href={`/accounts/${r.accountId}`} className="hover:underline">{r.accountId}</Link> },
            { header: "Purpose", cell: (r) => <Badge value={r.purpose} /> },
            { header: "Granted", cell: (r) => (r.granted ? "Granted" : "Withdrawn") },
            { header: "Terms version", cell: (r) => r.termsVersion },
            { header: "Captured", cell: (r) => formatDateTime(r.capturedAt) },
            { header: "Source", cell: (r) => r.source },
          ]}
        />
      </Section>
    </div>
  );
}
