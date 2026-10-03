import { prisma } from "@/lib/prisma";
import { DataTable } from "@/components/data-table";
import { DetailView } from "@/components/detail-view";
import { Badge } from "@/components/badge";
import { formatDateTime } from "@/lib/format";
import { getPlanState } from "@/lib/limits";
import { usedThisMonth } from "@/lib/assistant/quota";
import { PlanSubject } from "@/generated/prisma/enums";

/**
 * What the app itself shows or uses for this account, so support sees the
 * same thing the person sees: their phone, how they sign in, which
 * notifications they get, and their assistant use.
 */

type LastDevice = { platform?: string | null; os?: string | null; model?: string | null; appVersion?: string | null; build?: string | null; at?: string };

/** ACCT-09: the phone and app build last used, and the phones registered for push. */
export async function DeviceSection({ accountId, lastDevice }: { accountId: string; lastDevice: unknown }) {
  const d = (lastDevice ?? null) as LastDevice | null;
  const phones = await prisma.pushToken.findMany({ where: { accountId }, orderBy: { lastSeenAt: "desc" } });
  // "Behind current release": compared with the newest app version any account has used.
  const versions = await prisma.$queryRaw<{ v: string | null }[]>`
    SELECT DISTINCT "lastDevice"->>'appVersion' AS v FROM accounts WHERE "lastDevice" IS NOT NULL`;
  const latest = versions.map((r) => r.v).filter((v): v is string => !!v).sort(compareVersions).pop() ?? null;
  const behind = d?.appVersion && latest && compareVersions(d.appVersion, latest) < 0;
  return (
    <div className="space-y-3">
      <DetailView
        title="Last used"
        subtitle="Sent by the app with each request (model and versions only, no device identifiers)."
        fields={[
          { label: "Device", value: d?.model || (d ? "Unknown model" : "Not seen yet — the app reports it on its next request") },
          { label: "OS", value: d?.platform ? `${d.platform}${d.os ? ` ${d.os}` : ""}` : "—" },
          {
            label: "App build",
            value: d?.appVersion ? (
              <span>
                {d.appVersion}
                {d.build ? ` (${d.build})` : ""} {behind ? <Badge value="BEHIND" /> : null}
                {behind ? <span className="ml-2 text-xs text-neutral-500">Newest in use: {latest}</span> : null}
              </span>
            ) : (
              "—"
            ),
          },
          { label: "Last seen", value: d?.at ? formatDateTime(new Date(d.at)) : "—" },
        ]}
      />
      <DataTable
        rows={phones}
        emptyLabel="No phone registered for push notifications (none allowed yet, or Expo Go)."
        columns={[
          { header: "Phone for push", cell: (r) => r.platform },
          { header: "Registered", cell: (r) => formatDateTime(r.createdAt) },
          { header: "Last refreshed", cell: (r) => formatDateTime(r.lastSeenAt) },
        ]}
      />
    </div>
  );
}

/** How this person signs in, and their sessions (phones signed in). */
export async function SignInSection({ accountId, userId }: { accountId: string; userId: string }) {
  const now = new Date();
  const [identities, sessions] = await Promise.all([
    prisma.authIdentity.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }),
    prisma.endUserRefreshToken.findMany({
      where: { accountId, revokedAt: null, usedAt: null, expiresAt: { gt: now } },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);
  return (
    <div className="space-y-3">
      <DataTable
        rows={identities}
        emptyLabel="No Google or Apple sign-in linked (development test account, or created before sign-in existed)."
        columns={[
          { header: "Signs in with", cell: (r) => r.provider },
          { header: "Email from provider", cell: (r) => r.email ?? "Hidden by Apple" },
          { header: "Linked", cell: (r) => formatDateTime(r.createdAt) },
          { header: "Last used", cell: (r) => formatDateTime(r.lastUsedAt) },
        ]}
      />
      <DataTable
        rows={sessions}
        emptyLabel="Not signed in on any phone."
        columns={[
          { header: "Signed-in session", cell: (r) => r.userAgent ?? "App" },
          { header: "Started", cell: (r) => formatDateTime(r.createdAt) },
          { header: "Expires", cell: (r) => formatDateTime(r.expiresAt) },
        ]}
      />
      <p className="text-xs text-neutral-500">Reset sign-in (quick actions above) ends all of these and stops push to this account&rsquo;s phones.</p>
    </div>
  );
}

const CATEGORY_LABEL: Record<string, string> = {
  service: "Service due",
  docs: "Document expiry",
  jobs: "Estimates and jobs",
  money: "Invoices and payments",
  members: "Garage members",
  idle: "Project stalled",
};

/** My profile → Notifications as the person set it, and what was sent. */
export async function NotificationsSection({ accountId, prefs }: { accountId: string; prefs: unknown }) {
  const p = (prefs ?? {}) as Record<string, boolean>;
  const recent = await prisma.notification.findMany({ where: { accountId }, orderBy: { createdAt: "desc" }, take: 20 });
  return (
    <div className="space-y-3">
      <DetailView
        title="Notification settings"
        subtitle="Which kinds are pushed to the phone (every notification also shows in the app's list)."
        fields={Object.entries(CATEGORY_LABEL).map(([key, label]) => {
          const on = typeof p[key] === "boolean" ? p[key] : key !== "idle";
          return { label, value: on ? "On" : "Off" };
        })}
      />
      <DataTable
        rows={recent}
        emptyLabel="No notifications sent yet."
        columns={[
          { header: "Sent", cell: (r) => formatDateTime(r.createdAt) },
          { header: "Kind", cell: (r) => <Badge value={r.type} /> },
          { header: "Title", cell: (r) => r.title },
          { header: "Read", cell: (r) => (r.readAt ? formatDateTime(r.readAt) : "Unread") },
        ]}
      />
    </div>
  );
}

/** Assistant questions this month against the plan's monthly allowance. */
export async function AssistantSection({ accountId, workshopId }: { accountId: string; workshopId: string | null }) {
  const rows: { id: string; side: string; used: number; quota: string }[] = [];
  const owner = await getPlanState(PlanSubject.OWNER, accountId);
  rows.push({
    id: "owner",
    side: "Owner side",
    used: await usedThisMonth({ subject: PlanSubject.OWNER, id: accountId }).catch(() => 0),
    quota: owner?.plan.assistantMonthlyQuota == null ? "Unlimited" : String(owner.plan.assistantMonthlyQuota),
  });
  if (workshopId) {
    const ws = await getPlanState(PlanSubject.WORKSHOP, workshopId);
    rows.push({
      id: "workshop",
      side: "Workshop",
      used: await usedThisMonth({ subject: PlanSubject.WORKSHOP, id: workshopId }).catch(() => 0),
      quota: ws?.plan.assistantMonthlyQuota == null ? "Unlimited" : String(ws.plan.assistantMonthlyQuota),
    });
  }
  return (
    <DataTable
      rows={rows}
      columns={[
        { header: "Plan", cell: (r) => r.side },
        { header: "Questions this month", cell: (r) => r.used },
        { header: "Monthly allowance", cell: (r) => r.quota },
      ]}
    />
  );
}

function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map((n) => parseInt(n, 10) || 0);
  const pb = b.split(".").map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d) return d;
  }
  return 0;
}
