import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireRole, CONFIG_ROLES, CONFIG_PUBLISH_ROLES } from "@/lib/auth/rbac";
import { ConfigObjectType } from "@/generated/prisma/enums";
import { getDraft, diffAgainstLive, listVersionHistory } from "@/lib/config/versioning";
import { Section } from "@/components/detail-view";
import { MobileGapBanner } from "../../mobile-gap-banner";
import { VersionPanel } from "../../version-panel";
import { FlagForm, type FlagFormValues } from "./flag-form";

export const dynamic = "force-dynamic";

export default async function FlagEditPage({ params }: { params: Promise<{ key: string }> }) {
  const session = await requireRole(CONFIG_ROLES);
  const { key } = await params;

  const [flag, draft, exposureCount] = await Promise.all([
    prisma.featureFlag.findUnique({ where: { key } }),
    getDraft(ConfigObjectType.FEATURE_FLAG, key),
    prisma.featureFlagExposure.count({ where: { flag: { key } } }),
  ]);

  const draftPayload = draft?.payload as Partial<FlagFormValues> | undefined;

  const initial: FlagFormValues = {
    key,
    description: draftPayload?.description ?? flag?.description ?? "",
    isEnabled: draftPayload?.isEnabled ?? flag?.isEnabled ?? false,
    audience:
      draftPayload?.audience !== undefined
        ? (draftPayload.audience as FlagFormValues["audience"])
        : (flag?.audience as FlagFormValues["audience"] | null) ?? null,
  };

  const diff = draft
    ? await diffAgainstLive(ConfigObjectType.FEATURE_FLAG, key, draft.payload as Record<string, unknown>)
    : null;
  const history = await listVersionHistory(ConfigObjectType.FEATURE_FLAG, key);

  return (
    <div className="space-y-6">
      <Link href="/config/flags" className="text-sm text-neutral-500 hover:text-neutral-800">
        ← Feature flags
      </Link>

      <div>
        <h1 className="text-lg font-semibold text-neutral-900">{key}</h1>
        <p className="text-sm text-neutral-500">
          {flag ? `Live now (${flag.isEnabled ? "enabled" : "disabled"}).` : "No live row yet."} Exposures recorded:{" "}
          {exposureCount}.
        </p>
      </div>

      <MobileGapBanner>
        No code path in mobile or the API evaluates a feature flag today — this is authoring-only, the same
        &ldquo;authoring is real, no consumer reads it yet&rdquo; pattern as Messaging&rsquo;s What&rsquo;s new/Banners. Exposure
        counts above will read 0 until a consumer actually evaluates this flag and records a
        <code> FeatureFlagExposure</code> row.
      </MobileGapBanner>

      <Section title="Edit / stage draft">
        <FlagForm initial={initial} />
      </Section>

      <Section title="Draft, diff & publish">
        <VersionPanel
          objectKey={key}
          canPublish={CONFIG_PUBLISH_ROLES.includes(session.role)}
          draft={draft ? { id: draft.id, note: draft.note } : null}
          diff={diff}
          history={history}
          revalidate={`/config/flags/${key}`}
        />
      </Section>
    </div>
  );
}
