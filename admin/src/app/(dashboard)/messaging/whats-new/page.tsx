import { prisma } from "@/lib/prisma";
import { requireRole, MESSAGING_ROLES } from "@/lib/auth/rbac";
import { DataTable } from "@/components/data-table";
import { Section } from "@/components/detail-view";
import { formatDateTime } from "@/lib/format";
import { MessagingTabs } from "../messaging-tabs";
import { NewWhatsNewForm, PublishButton } from "./whats-new-form";

export const dynamic = "force-dynamic";

export default async function WhatsNewPage() {
  await requireRole(MESSAGING_ROLES);

  const notes = await prisma.whatsNewNote.findMany({
    include: { _count: { select: { views: true } }, views: { select: { readAt: true } } },
    orderBy: { createdAt: "desc" },
  });

  const rows = notes.map((n) => ({
    id: n.id,
    version: n.version,
    title: n.title,
    publishedAt: n.publishedAt,
    createdAt: n.createdAt,
    seenCount: n._count.views,
    readCount: n.views.filter((v) => v.readAt).length,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-neutral-900">Messaging</h1>
        <p className="text-sm text-neutral-500">What&rsquo;s-new notes (COMM-05), one per app version.</p>
      </div>

      <MessagingTabs active="whats-new" />

      <div className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
        No mobile client reads WhatsNewNote/WhatsNewView yet — this is the admin authoring/publish
        surface only. &ldquo;Shown once per account&rdquo; means checking for an existing WhatsNewView
        row before showing again; nothing exists today to do that check, so seen/read counts below will
        stay at zero until a mobile client is wired up to create these rows.
      </div>

      <Section title="Notes">
        <DataTable
          rows={rows}
          emptyLabel="No what's-new notes yet."
          columns={[
            { header: "Version", cell: (r) => r.version },
            { header: "Title", cell: (r) => r.title },
            {
              header: "Status",
              cell: (r) => (r.publishedAt ? `Published ${formatDateTime(r.publishedAt)}` : "Draft"),
            },
            { header: "Seen", cell: (r) => r.seenCount },
            { header: "Read", cell: (r) => r.readCount },
            { header: "Created", cell: (r) => formatDateTime(r.createdAt) },
            {
              header: "",
              cell: (r) => (!r.publishedAt ? <PublishButton noteId={r.id} /> : null),
            },
          ]}
        />
        <NewWhatsNewForm />
      </Section>
    </div>
  );
}
