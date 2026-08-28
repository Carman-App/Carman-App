import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Section } from "@/components/detail-view";
import { DataTable } from "@/components/data-table";
import { Badge } from "@/components/badge";
import { formatDateTime, titleCase } from "@/lib/format";
import { SuppressionForm } from "@/app/(dashboard)/messaging/suppression-form";

/**
 * COMM-02 "per-account message history (channel/time/delivery state)" +
 * COMM-03 "opt-outs respected... suppression by channel and message class".
 * Placed into accounts/[id]/page.tsx by the lead agent — this file only
 * owns its own subtree (src/app/(dashboard)/messaging/**), not the account
 * detail page itself.
 */
export async function MessagingHistorySection({ accountId }: { accountId: string }) {
  const [recipients, suppressions] = await Promise.all([
    prisma.campaignRecipient.findMany({
      where: { accountId },
      include: { campaign: { select: { id: true, name: true, messageClass: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.messageSuppression.findMany({
      where: { accountId },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return (
    <Section title="Messaging">
      <div className="space-y-4">
        <div>
          <h4 className="mb-1 text-xs font-medium text-neutral-500">Campaign message history</h4>
          <DataTable
            rows={recipients}
            href={(r) => `/messaging/campaigns/${r.campaignId}`}
            emptyLabel="No campaign messages sent to this account."
            columns={[
              { header: "Campaign", cell: (r) => r.campaign.name },
              { header: "Class", cell: (r) => <Badge value={r.campaign.messageClass} /> },
              { header: "Channel", cell: (r) => <Badge value={r.channel} /> },
              { header: "Delivery state", cell: (r) => <Badge value={r.deliveryState} /> },
              { header: "Reason", cell: (r) => r.suppressedReason ?? "—" },
              { header: "When", cell: (r) => formatDateTime(r.sentAt ?? r.createdAt) },
            ]}
          />
        </div>

        <div>
          <h4 className="mb-1 text-xs font-medium text-neutral-500">Active suppressions</h4>
          <p className="mb-2 text-xs text-neutral-500">
            Checked before every campaign send (src/lib/messaging/suppression.ts) — a row with a null
            channel or message class applies to all of them.
          </p>
          {suppressions.length === 0 ? (
            <p className="text-sm text-neutral-500">No suppressions on file for this account.</p>
          ) : (
            <ul className="space-y-1 text-sm text-neutral-700">
              {suppressions.map((s) => (
                <li key={s.id} className="rounded border border-neutral-200 px-3 py-2">
                  {titleCase(s.reason)} — {s.channel ? titleCase(s.channel) : "all channels"} /{" "}
                  {s.messageClass ? titleCase(s.messageClass) : "all classes"} — added{" "}
                  {formatDateTime(s.createdAt)}
                </li>
              ))}
            </ul>
          )}
          <div className="mt-2">
            <SuppressionForm accountId={accountId} />
          </div>
        </div>

        <Link href={`/messaging?accountId=${accountId}`} className="text-sm text-neutral-500 hover:underline">
          Full messaging console →
        </Link>
      </div>
    </Section>
  );
}
