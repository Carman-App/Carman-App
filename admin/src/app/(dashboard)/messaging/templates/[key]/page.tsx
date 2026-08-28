import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireRole, MESSAGING_ROLES } from "@/lib/auth/rbac";
import { TemplateForm } from "./template-form";

export const dynamic = "force-dynamic";

export default async function TemplateEditPage({
  params,
  searchParams,
}: {
  params: Promise<{ key: string }>;
  searchParams: Promise<{ language?: string }>;
}) {
  await requireRole(MESSAGING_ROLES);
  const { key } = await params;
  const { language: languageParam } = await searchParams;
  const language = languageParam || "en";

  const template = await prisma.notificationTemplate.findUnique({ where: { key_language: { key, language } } });

  return (
    <div className="space-y-6">
      <Link href="/messaging/templates" className="text-sm text-neutral-500 hover:text-neutral-800">
        ← Templates
      </Link>
      <div>
        <h1 className="text-lg font-semibold text-neutral-900">
          {key} <span className="text-neutral-500">({language})</span>
        </h1>
        {!template && (
          <p className="text-sm text-neutral-500">
            No row yet for this key/language — saving will create one. Change the Language field and
            save to add a translation.
          </p>
        )}
      </div>

      <TemplateForm
        templateKey={key}
        language={language}
        initialSubject={template?.subject ?? ""}
        initialBody={template?.body ?? ""}
        initialVariables={template?.variables ?? []}
      />
    </div>
  );
}
