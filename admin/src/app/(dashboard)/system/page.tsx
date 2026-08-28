import { requireRole, SYSTEM_ROLES } from "@/lib/auth/rbac";
import { Section } from "@/components/detail-view";
import { formatDateTime } from "@/lib/format";
import { getDeployInfo } from "@/lib/system/deploy-info";

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
        <NotConnected>
          <p>
            No job queue exists in this codebase today (no BullMQ or similar, no worker process, nothing
            durable tracking queued/running/failed work). Adding one is an architectural decision outside
            this task&rsquo;s scope, not something to fake here with an in-memory queue or a database table
            pretending to be one.
          </p>
          <p>Concretely, this page becoming real needs, in order:</p>
          <ol className="list-decimal space-y-1 pl-5">
            <li>
              A queue library adopted at the app level — e.g. BullMQ backed by Redis, or a Postgres-backed
              queue (e.g. graphile-worker/pg-boss) if avoiding a new infra dependency is preferred.
            </li>
            <li>One or more worker processes that actually run jobs pulled from that queue.</li>
            <li>
              Once jobs are enqueued and tracked somewhere durable, this page would list queued / running /
              failed jobs (type, enqueued time, attempts, last error) with a retry action per job, backed by
              the queue library&rsquo;s own retry primitive.
            </li>
          </ol>
        </NotConnected>
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
            No request-timing instrumentation exists — nothing wraps <code>/api/v1/*</code> routes with
            timing, so there&rsquo;s no p50/p95/error-latency data to show.
          </p>
          <p>
            Unlike the job queue and error-tracking gaps above, this one is small and scoped: a lightweight
            timing middleware in <code>src/proxy.ts</code> (or per-route) that records duration + route +
            status per request, writing to a small dedicated table (or forwarding to an APM tool if one is
            ever adopted). That&rsquo;s a buildable follow-on someone could pick up directly — it just
            isn&rsquo;t built yet, so this section stays a stated gap rather than a fabricated chart.
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
