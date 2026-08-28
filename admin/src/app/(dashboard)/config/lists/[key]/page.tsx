import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole, CONFIG_ROLES } from "@/lib/auth/rbac";
import { Section } from "@/components/detail-view";
import { NewListItemForm, ListItemRow } from "./list-item-form";

export const dynamic = "force-dynamic";

export default async function ListDetailPage({ params }: { params: Promise<{ key: string }> }) {
  await requireRole(CONFIG_ROLES);
  const { key } = await params;

  const list = await prisma.configList.findUnique({
    where: { key },
    include: { items: { orderBy: { sortOrder: "asc" } } },
  });
  if (!list) notFound();

  return (
    <div className="space-y-6">
      <Link href="/config/lists" className="text-sm text-neutral-500 hover:text-neutral-800">
        ← Lists
      </Link>

      <div>
        <h1 className="text-lg font-semibold text-neutral-900">{list.label}</h1>
        <p className="text-sm text-neutral-500">
          Key: <code>{list.key}</code>. Draft/publish/version-history is not wired up here — edits below go live
          immediately (still audit-logged).
        </p>
      </div>

      <Section title="Items">
        <div className="overflow-x-auto rounded border border-neutral-200">
          <table className="w-full min-w-max text-left text-sm">
            <thead className="bg-neutral-50 text-neutral-600">
              <tr>
                <th className="px-3 py-2 font-medium">Sort</th>
                <th className="px-3 py-2 font-medium">Code</th>
                <th className="px-3 py-2 font-medium">Label</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Metadata</th>
                <th className="px-3 py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {list.items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-neutral-500">
                    No items yet — add one below.
                  </td>
                </tr>
              ) : (
                list.items.map((item) => <ListItemRow key={item.id} listKey={list.key} item={item} />)
              )}
            </tbody>
          </table>
        </div>
        <div className="mt-3">
          <NewListItemForm listKey={list.key} />
        </div>
      </Section>
    </div>
  );
}
