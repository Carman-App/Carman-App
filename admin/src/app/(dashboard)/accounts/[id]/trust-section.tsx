import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Section } from "@/components/detail-view";
import { Badge } from "@/components/badge";
import { formatDateTime } from "@/lib/format";

// Active/past capability restrictions on this account, plus abuse reports
// involving it both as the reported party and as the reporter.

export async function TrustSection({ accountId }: { accountId: string }) {
  const [restrictions, reportsAgainst, reportsFiled] = await Promise.all([
    prisma.capabilityRestriction.findMany({
      where: { accountId },
      orderBy: { createdAt: "desc" },
    }),
    prisma.abuseReport.findMany({
      where: { reportedAccountId: accountId },
      orderBy: { createdAt: "desc" },
    }),
    prisma.abuseReport.findMany({
      where: { reporterAccountId: accountId },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const adminIds = [
    ...new Set([
      ...restrictions.map((r) => r.createdByAdminId),
      ...restrictions.map((r) => r.liftedByAdminId).filter((v): v is string => Boolean(v)),
    ]),
  ];
  const admins = adminIds.length
    ? await prisma.adminUser.findMany({ where: { id: { in: adminIds } }, select: { id: true, name: true } })
    : [];
  const adminNames = new Map(admins.map((a) => [a.id, a.name]));

  const now = new Date().getTime();
  const isActive = (r: (typeof restrictions)[number]) => !r.liftedAt && r.endAt.getTime() > now;

  return (
    <Section title="Trust & safety">
      <div className="space-y-4">
        <div>
          <p className="mb-1 text-xs text-neutral-500">Capability restrictions</p>
          {restrictions.length === 0 ? (
            <p className="text-sm text-neutral-500">None.</p>
          ) : (
            <ul className="space-y-1">
              {restrictions.map((r) => (
                <li key={r.id} className="rounded border border-neutral-200 px-3 py-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Badge value={r.capability} />
                    {isActive(r) ? (
                      <span className="text-xs text-amber-700">Active until {formatDateTime(r.endAt)}</span>
                    ) : r.liftedAt ? (
                      <span className="text-xs text-neutral-500">Lifted {formatDateTime(r.liftedAt)}</span>
                    ) : (
                      <span className="text-xs text-neutral-500">Expired {formatDateTime(r.endAt)}</span>
                    )}
                  </div>
                  <p className="mt-1 text-neutral-700">{r.reason}</p>
                  <p className="text-xs text-neutral-500">By {adminNames.get(r.createdByAdminId) ?? r.createdByAdminId}</p>
                </li>
              ))}
            </ul>
          )}
          <Link href="/trust/restrictions" className="mt-1 inline-block text-xs text-neutral-500 hover:underline">
            All restrictions →
          </Link>
        </div>

        <div>
          <p className="mb-1 text-xs text-neutral-500">Abuse reports — this account reported</p>
          {reportsAgainst.length === 0 ? (
            <p className="text-sm text-neutral-500">None.</p>
          ) : (
            <ul className="space-y-1">
              {reportsAgainst.map((r) => (
                <li key={r.id} className="rounded border border-neutral-200 px-3 py-2 text-sm">
                  <Link href={`/trust/reports/${r.id}`} className="text-neutral-800 hover:underline">
                    {r.reason}
                  </Link>
                  <span className="ml-2">
                    <Badge value={r.status} />
                  </span>
                  <p className="text-xs text-neutral-500">{formatDateTime(r.createdAt)}</p>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <p className="mb-1 text-xs text-neutral-500">Abuse reports — filed by this account</p>
          {reportsFiled.length === 0 ? (
            <p className="text-sm text-neutral-500">None.</p>
          ) : (
            <ul className="space-y-1">
              {reportsFiled.map((r) => (
                <li key={r.id} className="rounded border border-neutral-200 px-3 py-2 text-sm">
                  <Link href={`/trust/reports/${r.id}`} className="text-neutral-800 hover:underline">
                    {r.reason}
                  </Link>
                  <span className="ml-2">
                    <Badge value={r.status} />
                  </span>
                  <p className="text-xs text-neutral-500">{formatDateTime(r.createdAt)}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Section>
  );
}
