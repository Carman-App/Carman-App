import Link from "next/link";
import { requireAdmin, canViewPulseFeed, canAccessAccounts, canLinkToAccount, BILLING_ROLES } from "@/lib/auth/rbac";
import {
  PULSE_METRIC_KEYS,
  PULSE_TIMEZONE_LABEL,
  REPORTING_CURRENCY,
  REPORTING_CURRENCY_NOTE,
  DEFAULT_PINNED_METRICS,
  getAllMetricSnapshots,
  type PulseMetricKey,
  type MetricSnapshot,
} from "@/lib/pulse/metrics";
import { buildAlerts } from "@/lib/pulse/alerts";
import { getLiveFeed, feedEventLabel } from "@/lib/pulse/feed";
import { savePinnedMetrics } from "./pulse-actions";
import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@/lib/format";

// Pulse is the page the console opens on (AGENTS.md) — must be readable
// "in the time it takes to drink something." Queries the DB at request
// time, never at build time (no live DB guaranteed at build).
export const dynamic = "force-dynamic";

function linkForMetric(key: PulseMetricKey, role: Parameters<typeof canAccessAccounts>[0]): string | undefined {
  switch (key) {
    case "signups":
    case "active_users":
      return canAccessAccounts(role) ? "/accounts" : undefined;
    case "records_logged":
      return canAccessAccounts(role) ? "/records" : undefined;
    case "jobs_opened":
      return canAccessAccounts(role) ? "/jobs" : undefined;
    case "invoices_raised":
    case "money_collected":
      return BILLING_ROLES.includes(role) ? "/billing" : undefined;
    case "errors":
      return undefined;
  }
}

function formatMetricValue(key: PulseMetricKey, value: number | null): string {
  if (value == null) return "—";
  if (key === "money_collected") {
    return new Intl.NumberFormat("en-KE", { style: "currency", currency: REPORTING_CURRENCY, maximumFractionDigits: 0 }).format(value);
  }
  return Math.round(value).toLocaleString();
}

function DirectionArrow({ direction }: { direction: MetricSnapshot["direction"] }) {
  if (direction === "up") return <span className="text-emerald-600">▲</span>;
  if (direction === "down") return <span className="text-red-600">▼</span>;
  if (direction === "flat") return <span className="text-neutral-500">▬</span>;
  return <span className="text-neutral-500">?</span>;
}

function MetricCard({ snapshot, href }: { snapshot: MetricSnapshot; href?: string }) {
  const body = (
    <div className="rounded border border-neutral-200 bg-neutral-50 p-4 transition hover:border-neutral-300">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">{snapshot.label}</p>
        <DirectionArrow direction={snapshot.direction} />
      </div>
      <p className="mt-1 text-2xl font-semibold text-neutral-900">
        {formatMetricValue(snapshot.key, snapshot.today)}
      </p>
      {snapshot.untrackedReason ? (
        <p className="mt-2 text-xs text-neutral-500">{snapshot.untrackedReason}</p>
      ) : (
        <div className="mt-2 space-y-0.5 text-xs text-neutral-500">
          <p>
            7-day avg: {snapshot.trailing7Avg?.toFixed(1)} · Yesterday: {formatMetricValue(snapshot.key, snapshot.yesterday)}
          </p>
          <p>
            This week vs last: {snapshot.weekDeltaAbsolute! >= 0 ? "+" : ""}
            {Math.round(snapshot.weekDeltaAbsolute ?? 0).toLocaleString()} (
            {snapshot.weekDeltaPercent! >= 0 ? "+" : ""}
            {snapshot.weekDeltaPercent?.toFixed(0)}%)
          </p>
        </div>
      )}
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

export default async function PulsePage() {
  const admin = await requireAdmin(); // Pulse's aggregate numbers are visible to every role — READ's whole purpose.

  const [snapshots, pref, accountTotal] = await Promise.all([
    getAllMetricSnapshots(),
    prisma.adminPulsePreference.findUnique({ where: { adminUserId: admin.adminId } }),
    prisma.account.count(),
  ]);

  const pinned = (pref?.metricKeys as PulseMetricKey[] | undefined)?.filter((k) =>
    (PULSE_METRIC_KEYS as readonly string[]).includes(k),
  );
  const pinnedKeys = pinned && pinned.length > 0 ? pinned : DEFAULT_PINNED_METRICS;
  const restKeys = PULSE_METRIC_KEYS.filter((k) => !pinnedKeys.includes(k));

  const alerts = buildAlerts(snapshots, (key) => linkForMetric(key, admin.role));
  const realAlerts = alerts.filter((a) => a.severity === "real");
  const notWiredAlerts = alerts.filter((a) => a.severity === "not_wired");

  const feed = canViewPulseFeed(admin.role) ? await getLiveFeed(30) : null;
  const canLink = canLinkToAccount(admin.role);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-lg font-semibold text-neutral-900">Pulse</h1>
        <p className="text-sm text-neutral-500">
          {accountTotal.toLocaleString()} accounts total. All &ldquo;today&rdquo;/&ldquo;yesterday&rdquo;/weekly
          figures on this page use a fixed reference timezone: <strong>{PULSE_TIMEZONE_LABEL}</strong> — not
          your browser&rsquo;s local time. Money figures are in a single reporting currency,{" "}
          <strong>{REPORTING_CURRENCY}</strong>: {REPORTING_CURRENCY_NOTE}
        </p>
      </div>

      {/* PULSE-02: alert strip, above the numbers. */}
      <section className="space-y-2">
        <h2 className="text-sm font-medium text-neutral-600">Alerts</h2>
        {realAlerts.length === 0 ? (
          <p className="rounded border border-dashed border-neutral-200 px-4 py-3 text-sm text-neutral-500">
            Nothing outside its normal band right now.
          </p>
        ) : (
          <ul className="space-y-2">
            {realAlerts.map((a) => (
              <li
                key={a.id}
                className="rounded border border-amber-200 bg-amber-50 px-4 py-2 text-sm"
              >
                {a.href ? (
                  <Link href={a.href} className="font-medium text-amber-800 hover:underline">
                    {a.title}
                  </Link>
                ) : (
                  <span className="font-medium text-amber-800">{a.title}</span>
                )}
                <p className="text-xs text-amber-800/70">{a.description}</p>
              </li>
            ))}
          </ul>
        )}
        <details className="rounded border border-neutral-200 px-4 py-2 text-sm text-neutral-500">
          <summary className="cursor-pointer text-neutral-600">
            {notWiredAlerts.length} alert type(s) not wired up yet
          </summary>
          <ul className="mt-2 space-y-2">
            {notWiredAlerts.map((a) => (
              <li key={a.id}>
                <span className="font-medium text-neutral-700">{a.title}</span>
                <p className="text-xs text-neutral-500">{a.description}</p>
              </li>
            ))}
          </ul>
        </details>
      </section>

      {/* PULSE-01/04/05/06: headline numbers, pinned-first. */}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-neutral-600">Pinned</h2>
          <details className="text-xs text-neutral-500">
            <summary className="cursor-pointer hover:text-neutral-700">Customize pinned metrics</summary>
            <form action={savePinnedMetrics} className="mt-2 space-y-1 rounded border border-neutral-200 p-3">
              <p className="text-neutral-500">Pick up to 5 to pin to the top (saved to your admin account):</p>
              {PULSE_METRIC_KEYS.map((key) => (
                <label key={key} className="flex items-center gap-2 text-neutral-700">
                  <input type="checkbox" name="metric" value={key} defaultChecked={pinnedKeys.includes(key)} />
                  {snapshots[key].label}
                </label>
              ))}
              <button
                type="submit"
                className="mt-2 rounded-full bg-carma-600 px-3 py-1 text-xs font-medium text-white hover:bg-carma-700"
              >
                Save
              </button>
            </form>
          </details>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {pinnedKeys.map((key) => (
            <MetricCard key={key} snapshot={snapshots[key]} href={linkForMetric(key, admin.role)} />
          ))}
        </div>
      </section>

      {restKeys.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-medium text-neutral-600">More metrics</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {restKeys.map((key) => (
              <MetricCard key={key} snapshot={snapshots[key]} href={linkForMetric(key, admin.role)} />
            ))}
          </div>
        </section>
      )}

      {/* PULSE-03: live feed, newest first — type + account only. */}
      <section className="space-y-2">
        <h2 className="text-sm font-medium text-neutral-600">Live feed</h2>
        {feed === null ? (
          <p className="rounded border border-dashed border-neutral-200 px-4 py-3 text-sm text-neutral-500">
            Your role (Read-only) sees aggregate numbers only — the live feed names accounts, so
            it isn&rsquo;t shown here.
          </p>
        ) : feed.length === 0 ? (
          <p className="rounded border border-dashed border-neutral-200 px-4 py-3 text-sm text-neutral-500">
            No activity yet.
          </p>
        ) : (
          <div className="overflow-x-auto rounded border border-neutral-200">
            <table className="w-full min-w-max text-left text-sm">
              <thead className="bg-neutral-50 text-neutral-600">
                <tr>
                  <th className="whitespace-nowrap px-4 py-2 font-medium">When</th>
                  <th className="whitespace-nowrap px-4 py-2 font-medium">Type</th>
                  <th className="whitespace-nowrap px-4 py-2 font-medium">Account</th>
                  <th className="whitespace-nowrap px-4 py-2 font-medium">Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {feed.map((item) => (
                  <tr key={item.id} className="hover:bg-neutral-100">
                    <td className="whitespace-nowrap px-4 py-2">{formatDateTime(item.at)}</td>
                    <td className="whitespace-nowrap px-4 py-2">{feedEventLabel(item.type)}</td>
                    <td className="whitespace-nowrap px-4 py-2">
                      {canLink ? (
                        <Link href={`/accounts/${item.accountId}`} className="hover:underline">
                          {item.accountName}
                        </Link>
                      ) : (
                        item.accountName
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2 text-neutral-600">{item.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
