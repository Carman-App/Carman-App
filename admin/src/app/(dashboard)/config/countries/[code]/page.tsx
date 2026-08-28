import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireRole, CONFIG_ROLES, CONFIG_PUBLISH_ROLES } from "@/lib/auth/rbac";
import { ConfigObjectType } from "@/generated/prisma/enums";
import { getDraft, diffAgainstLive, listVersionHistory } from "@/lib/config/versioning";
import { Section } from "@/components/detail-view";
import { MobileGapBanner } from "../../mobile-gap-banner";
import { VersionPanel } from "../../version-panel";
import { CountryForm, type CountryFormValues } from "./country-form";

export const dynamic = "force-dynamic";

export default async function CountryEditPage({ params }: { params: Promise<{ code: string }> }) {
  const session = await requireRole(CONFIG_ROLES);
  const { code: rawCode } = await params;
  const code = rawCode.toUpperCase();

  const [country, draft] = await Promise.all([
    prisma.country.findUnique({ where: { code } }),
    getDraft(ConfigObjectType.COUNTRY, code),
  ]);

  const draftPayload = draft?.payload as Partial<CountryFormValues> | undefined;

  const initial: CountryFormValues = {
    code,
    name: draftPayload?.name ?? country?.name ?? "",
    currencyCode: draftPayload?.currencyCode ?? country?.currencyCode ?? "",
    currencySymbol: draftPayload?.currencySymbol ?? country?.currencySymbol ?? "",
    currencySymbolPlacement: draftPayload?.currencySymbolPlacement ?? country?.currencySymbolPlacement ?? "BEFORE",
    distanceUnit: draftPayload?.distanceUnit ?? country?.distanceUnit ?? "KM",
    volumeUnit: draftPayload?.volumeUnit ?? country?.volumeUnit ?? "LITRE",
    dateFormat: draftPayload?.dateFormat ?? country?.dateFormat ?? "DD/MM/YYYY",
    flagEmoji: draftPayload?.flagEmoji ?? country?.flagEmoji ?? "",
    isLive: draftPayload?.isLive ?? country?.isLive ?? false,
  };

  const diff = draft
    ? await diffAgainstLive(ConfigObjectType.COUNTRY, code, draft.payload as Record<string, unknown>)
    : null;
  const history = await listVersionHistory(ConfigObjectType.COUNTRY, code);

  return (
    <div className="space-y-6">
      <Link href="/config" className="text-sm text-neutral-500 hover:text-neutral-800">
        ← Countries
      </Link>

      <div>
        <h1 className="text-lg font-semibold text-neutral-900">
          {country ? `${country.flagEmoji ?? ""} ${country.name}`.trim() : `New country — ${code}`}
        </h1>
        <p className="text-sm text-neutral-500">
          {country ? `Live now (${country.isLive ? "live" : "hidden"}).` : "No live row yet — staging a draft and publishing it will create one."}
        </p>
      </div>

      <MobileGapBanner>
        The mobile app currently hardcodes its country/currency/unit rules in <code>mobile/src/data</code> and{" "}
        <code>mobile/src/types/domain.ts</code> — it does not read this <code>Country</code> table. Publishing a
        change here is real and versioned, but has zero live effect until a separate follow-on change makes the
        mobile app fetch this config instead of using its hardcoded version.
      </MobileGapBanner>

      <Section title="Edit / stage draft">
        <CountryForm code={code} initial={initial} />
      </Section>

      <Section title="Draft, diff & publish">
        <VersionPanel
          objectKey={code}
          canPublish={CONFIG_PUBLISH_ROLES.includes(session.role)}
          draft={draft ? { id: draft.id, note: draft.note } : null}
          diff={diff}
          history={history}
          revalidate={`/config/countries/${code}`}
        />
      </Section>
    </div>
  );
}
