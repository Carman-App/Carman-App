import { prisma } from "@/lib/prisma";
import { requireRole, MESSAGING_ROLES } from "@/lib/auth/rbac";
import { DataTable } from "@/components/data-table";
import { Section } from "@/components/detail-view";
import { formatDateTime } from "@/lib/format";
import { MessagingTabs } from "../messaging-tabs";
import { SEED_TEMPLATES } from "@/lib/messaging/templates";

export const dynamic = "force-dynamic";

/**
 * Idempotent: creates any of the six required keys (language "en") that
 * don't exist yet, so the editor isn't empty on first load. Never
 * overwrites an existing row — an admin's saved edit always wins.
 */
async function ensureSeedTemplates(): Promise<void> {
  const existing = await prisma.notificationTemplate.findMany({
    where: { language: "en", key: { in: SEED_TEMPLATES.map((t) => t.key) } },
    select: { key: true },
  });
  const existingKeys = new Set(existing.map((t) => t.key));
  const missing = SEED_TEMPLATES.filter((t) => !existingKeys.has(t.key));
  if (missing.length === 0) return;

  await prisma.notificationTemplate.createMany({
    data: missing.map((t) => ({
      key: t.key,
      language: "en",
      subject: t.subject,
      body: t.body,
      variables: t.variables,
    })),
  });
}

export default async function TemplatesPage() {
  await requireRole(MESSAGING_ROLES);
  await ensureSeedTemplates();

  const templates = await prisma.notificationTemplate.findMany({ orderBy: [{ key: "asc" }, { language: "asc" }] });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-neutral-900">Messaging</h1>
        <p className="text-sm text-neutral-500">
          Automatic notification templates (COMM-04), per language.
        </p>
      </div>

      <MessagingTabs active="templates" />

      <div className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
        Editing here does not change what the app actually sends today. No code path in this codebase
        reads from NotificationTemplate to render a real notification — the one real notify() call site
        (garage ownership transfer) hardcodes its own title/body inline. This is the editing surface for
        when a real send path is built to read from these rows.
      </div>

      <Section title="Templates">
        <DataTable
          rows={templates}
          href={(r) => `/messaging/templates/${r.key}?language=${r.language}`}
          emptyLabel="No templates yet."
          columns={[
            { header: "Key", cell: (r) => r.key },
            { header: "Language", cell: (r) => r.language },
            { header: "Subject", cell: (r) => r.subject ?? "—" },
            { header: "Variables", cell: (r) => (r.variables.length > 0 ? r.variables.join(", ") : "—") },
            { header: "Updated", cell: (r) => formatDateTime(r.updatedAt) },
          ]}
        />
      </Section>
    </div>
  );
}
