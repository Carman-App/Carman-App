import { prisma } from "@/lib/prisma";
import { requireRole, CONFIG_ROLES } from "@/lib/auth/rbac";
import { DataTable } from "@/components/data-table";
import { Section } from "@/components/detail-view";
import { formatDateTime } from "@/lib/format";
import { ConfigTabs } from "./config-tabs";
import { MobileGapBanner } from "./mobile-gap-banner";
import { GoToCountryForm } from "./countries/go-to-country-form";

export const dynamic = "force-dynamic";

export default async function ConfigCountriesPage() {
  await requireRole(CONFIG_ROLES);

  const countries = await prisma.country.findMany({ orderBy: { name: "asc" } });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-neutral-900">Configuration</h1>
        <p className="text-sm text-neutral-500">CFG-01 Country list — currency, units, date format, live toggle.</p>
      </div>

      <ConfigTabs active="countries" />

      <MobileGapBanner>
        The mobile app currently hardcodes its country/currency/unit rules — this table is not read by any mobile
        or API code path yet. Publishing a country here is real and versioned (draft → diff → publish → revert),
        but has no live effect until a separate follow-on change makes the mobile app fetch from here instead.
      </MobileGapBanner>

      <Section title="Countries">
        <DataTable
          rows={countries}
          emptyLabel="No countries yet — add one below."
          href={(c) => `/config/countries/${c.code}`}
          columns={[
            { header: "Code", cell: (c) => c.code },
            { header: "Name", cell: (c) => `${c.flagEmoji ?? ""} ${c.name}`.trim() },
            { header: "Currency", cell: (c) => `${c.currencyCode} (${c.currencySymbol}, ${c.currencySymbolPlacement})` },
            { header: "Units", cell: (c) => `${c.distanceUnit} / ${c.volumeUnit}` },
            { header: "Date format", cell: (c) => c.dateFormat },
            { header: "Status", cell: (c) => (c.isLive ? "Live" : "Hidden") },
            { header: "Updated", cell: (c) => formatDateTime(c.updatedAt) },
          ]}
        />
        <GoToCountryForm />
      </Section>
    </div>
  );
}
