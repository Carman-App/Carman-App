import Link from "next/link";
import { requireRole, SYSTEM_ROLES } from "@/lib/auth/rbac";
import { Section } from "@/components/detail-view";
import { formatDateTime } from "@/lib/format";
import { getDeployInfo } from "@/lib/system/deploy-info";
import { getJobQueueOverview } from "@/lib/system/jobs";
import { RetryJobButton } from "./retry-job-button";

// System (OPS-01..07) is introspective platform/ops visibility — OWNER-only
// (see src/lib/auth/rbac.ts SYSTEM_ROLES). Reads live state at request time.
export const dynamic = "force-dynamic";

function NotConnected({ envVar, children }: { envVar?: string; children: React.ReactNode }) {
  return (
    <div className="rounded border border-dashed border-neutral-200 p-6 text-sm text-neutral-500">
      <p className="font-medium text-neutral-700">Not connected{envVar ? ` — requires ${envVar}` : ""}</p>
      <div className="mt-2 space-y-2 text-neutral-500">{children}</div>
    </div>
  );
}

function EnvVarStatus({ name }: { name: string }) {
  // Informational only — this checks whether the var is *set*, not whether
  // anything actually consumes it. Nothing in this codebase reads this var
  // at runtime, so the page still says "not connected" either way.
  const isSet = Boolean(process.env[name]);
  return (
    <p className="text-xs text-neutral-500">
      <code>{name}</code> in this environment: {isSet ? "set" : "not set"} — informational only, no code path
      reads it yet.
    </p>
  );
}

export default async function SystemPage() {
  await requireRole(SYSTEM_ROLES);

  const deployInfo = getDeployInfo();
  const jobOverview = await getJobQueueOverview();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-lg font-semibold text-neutral-900">System</h1>
        <p className="text-sm text-neutral-500">
          Platform/ops visibility — error rates, background jobs, deploy state, response times, backups, and
          cost trends. Most of this needs infrastructure this codebase doesn&rsquo;t have yet; each section
          below states plainly what&rsquo;s real and what&rsquo;s waiting on a prerequisite.
        </p>
      </div>

      {/* OPS-01 — Error rate + top failures */}
      <Section title="Error rate & top failures">
        <NotConnected envVar="SENTRY_DSN">
          <p>
            No error-tracking integration exists anywhere in this codebase — no Sentry (or similar) SDK is
            installed, and no server-side exception-capture hook is wired up. There is nothing to chart or
            list yet, so the placeholders below show the shape this view will take once one is connected, not
            real data.
          </p>
          <EnvVarStatus name="SENTRY_DSN" />
          <EnvVarStatus name="SENTRY_ENVIRONMENT" />
        </NotConnected>

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <div className="rounded border border-neutral-200 bg-neutral-50 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">Error rate (placeholder)</p>
            <div className="mt-3 flex h-32 items-end justify-between gap-1 opacity-30">
              {[3, 5, 2, 6, 4, 7, 3, 5, 2, 4, 6, 3].map((h, i) => (
                <div key={i} className="flex-1 rounded-t bg-neutral-600" style={{ height: `${h * 10}%` }} />
              ))}
            </div>
            <p className="mt-2 text-xs text-neutral-500">Illustrative shape only — no real data behind it.</p>
          </div>
          <div className="rounded border border-neutral-200 bg-neutral-50 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">Top failures (placeholder)</p>
            <table className="mt-3 w-full text-left text-sm opacity-30">
              <thead className="text-neutral-500">
                <tr>
                  <th className="py-1 font-medium">Error</th>
                  <th className="py-1 font-medium">Count</th>
                  <th className="py-1 font-medium">Last seen</th>
                </tr>
              </thead>
              <tbody className="text-neutral-600">
                <tr>
                  <td className="py-1">—</td>
                  <td className="py-1">—</td>
                  <td className="py-1">—</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </Section>

      {/* OPS-02 / OPS-03 — Background job visibility + retry */}
      <Section title="Background jobs (visibility & retry)">
        <div className="rounded border border-neutral-200 bg-neutral-50 p-3 text-xs text-neutral-600">
          Real data from the Postgres-backed <code>BackgroundJob</code> queue (see{" "}
          <code>src/lib/queue/queue.ts</code>, built in the scalability pass) — today&rsquo;s only two job
          types are <code>report.generate</code> and <code>notification.dispatch</code>; there is no image-
          processing job type yet (no image upload pipeline exists). No always-on worker process is deployed
          — <code>scripts/queue-worker.ts</code> must be run manually alongside <code>npm run dev</code>
          today, so queued jobs only drain while that script is running.
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {(["PENDING", "PROCESSING", "COMPLETED", "FAILED", "CANCELLED"] as const).map((status) => (
            <div key={status} className="rounded border border-neutral-200 p-3 text-center">
              <p className="text-xs uppercase tracking-wide text-neutral-500">
                {status === "PENDING" ? "Queued" : status === "PROCESSING" ? "Running" : status.charAt(0) + status.slice(1).toLowerCase()}
              </p>
              <p className="mt-1 text-xl font-semibold text-neutral-900">
                {jobOverview.countsByStatus[status] ?? 0}
              </p>
            </div>
          ))}
        </div>

        <p className="text-xs text-neutral-500">
          {jobOverview.retriedCount} job(s) have needed more than one attempt so far (the closest honest
          reading of &ldquo;retried&rdquo; this queue tracks — there is no separate RETRIED status; a retried
          job just goes back to PENDING with attempts &gt; 1).
        </p>

        <div className="rounded border border-neutral-200 p-3 text-sm">
          <span className="font-medium text-neutral-700">Oldest waiting item: </span>
          {jobOverview.oldestWaiting ? (
            <span className="text-neutral-600">
              <code>{jobOverview.oldestWaiting.type}</code> ({jobOverview.oldestWaiting.id}), due since{" "}
              {formatDateTime(jobOverview.oldestWaiting.runAt)}, attempt {jobOverview.oldestWaiting.attempts}.
            </span>
          ) : (
            <span className="text-neutral-500">Nothing queued.</span>
          )}
        </div>

        <div>
          <p className="mb-2 text-sm font-medium text-neutral-700">
            Failed jobs ({jobOverview.recentFailed.length})
          </p>
          {jobOverview.recentFailed.length === 0 ? (
            <p className="rounded border border-dashed border-neutral-200 px-4 py-3 text-sm text-neutral-500">
              No failed jobs on file.
            </p>
          ) : (
            <div className="overflow-x-auto rounded border border-neutral-200">
              <table className="w-full min-w-max text-left text-sm">
                <thead className="bg-neutral-50 text-neutral-600">
                  <tr>
                    <th className="whitespace-nowrap px-3 py-2 font-medium">Type</th>
                    <th className="whitespace-nowrap px-3 py-2 font-medium">Account</th>
                    <th className="whitespace-nowrap px-3 py-2 font-medium">Attempts</th>
                    <th className="px-3 py-2 font-medium">Last error</th>
                    <th className="whitespace-nowrap px-3 py-2 font-medium">Last updated</th>
                    <th className="whitespace-nowrap px-3 py-2 font-medium" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200">
                  {jobOverview.recentFailed.map((j) => (
                    <tr key={j.id} className="hover:bg-neutral-100">
                      <td className="whitespace-nowrap px-3 py-2 font-mono text-xs">{j.type}</td>
                      <td className="whitespace-nowrap px-3 py-2">
                        {j.accountId ? (
                          <Link href={`/accounts/${j.accountId}`} className="hover:underline">
                            {j.accountName}
                          </Link>
                        ) : (
                          <span className="text-neutral-400">—</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2">
                        {j.attempts}/{j.maxAttempts}
                      </td>
                      <td className="max-w-sm truncate px-3 py-2 text-xs text-neutral-600" title={j.lastError ?? ""}>
                        {j.lastError ?? "—"}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-neutral-600">{formatDateTime(j.updatedAt)}</td>
                      <td className="whitespace-nowrap px-3 py-2">
                        <RetryJobButton jobId={j.id} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Section>

      {/* OPS-04 — Deployment info (genuinely real) */}
      <Section title="Deployment info">
        <div className="rounded border border-neutral-200">
          <div className="border-b border-neutral-200 px-4 py-3">
            <p className="text-sm text-neutral-600">
              Reads the current checked-out repo state at request time — <code>admin/package.json</code> and{" "}
              <code>mobile/package.json</code> versions, plus <code>git</code> commands run against the
              monorepo root. There is no separate deploy pipeline per surface (owner app / mechanic app /
              console / API) and no deploy-time or &ldquo;previous version&rdquo; history tracked anywhere —
              this is one shared repo state, not a deploy history.
            </p>
          </div>
          <dl className="divide-y divide-neutral-200">
            <div className="grid grid-cols-3 gap-4 px-4 py-3 text-sm">
              <dt className="text-neutral-500">Admin console version</dt>
              <dd className="col-span-2 text-neutral-800">{deployInfo.adminVersion ?? "unavailable"}</dd>
            </div>
            <div className="grid grid-cols-3 gap-4 px-4 py-3 text-sm">
              <dt className="text-neutral-500">Mobile app version</dt>
              <dd className="col-span-2 text-neutral-800">{deployInfo.mobileVersion ?? "unavailable"}</dd>
            </div>
            <div className="grid grid-cols-3 gap-4 px-4 py-3 text-sm">
              <dt className="text-neutral-500">Git commit</dt>
              <dd className="col-span-2 font-mono text-neutral-800">
                {deployInfo.git.available
                  ? `${deployInfo.git.shortCommit} (${deployInfo.git.commit})`
                  : "unavailable — git isn't on PATH or the call failed"}
              </dd>
            </div>
            <div className="grid grid-cols-3 gap-4 px-4 py-3 text-sm">
              <dt className="text-neutral-500">Last commit date</dt>
              <dd className="col-span-2 text-neutral-800">
                {deployInfo.git.commitDate ? formatDateTime(deployInfo.git.commitDate) : "unavailable"}
              </dd>
            </div>
          </dl>
        </div>
      </Section>

      {/* OPS-05 — Response times */}
      <Section title="Response times">
        <NotConnected>
          <p>
            Partially real, not fully: the scalability pass added <code>src/lib/logging/logger.ts</code> +{" "}
            <code>withApiLogging</code>, which now records a real <code>durationMs</code> per request for
            sign-in and the load-tested record/report/job/estimate/invoice routes — but only as a JSON line to{" "}
            <code>console.log</code>, not to a queryable table. There is nothing this page can read back to
            compute a real median/p95, so the number itself still isn&rsquo;t shown here — this is a stated
            gap in the aggregation, not in the instrumentation (which now partly exists).
          </p>
          <p>
            Closing this needs one more step: write each logged duration to a small dedicated table (or
            forward to an APM tool if one is ever adopted) instead of only `console.log`, then aggregate
            p50/p95 from that table here. That&rsquo;s a small, scoped follow-on — the hard part (measuring
            duration per request) is already done for the routes listed above.
          </p>
        </NotConnected>
      </Section>

      {/* OPS-06 — Backup state */}
      <Section title="Backup state">
        <NotConnected>
          <p>
            Neon (the Postgres provider in use — see <code>admin/README.md</code>) handles backups itself,
            and this codebase has no Neon Management API credentials or calls configured anywhere to surface
            that state here. Backup/restore-test status needs to be checked directly in the Neon dashboard
            for now.
          </p>
          <p>
            <a
              href="https://console.neon.tech"
              target="_blank"
              rel="noreferrer"
              className="text-neutral-700 underline hover:text-neutral-900"
            >
              console.neon.tech
            </a>{" "}
            — external guidance link only, not a live-data widget.
          </p>
        </NotConnected>
      </Section>

      {/* OPS-07 — Storage/processing cost trends */}
      <Section title="Storage & processing cost trends">
        <NotConnected envVar="CLOUD_BILLING_API_KEY">
          <p>
            No cloud billing API is integrated. The exact shape depends on which host is billing (Postgres/S3
            /compute could each be a different provider — Neon, AWS, Cloudflare, etc. — each with its own
            billing API), so nothing is fetched or estimated here.
          </p>
          <EnvVarStatus name="CLOUD_BILLING_API_KEY" />
        </NotConnected>
      </Section>
    </div>
  );
}
