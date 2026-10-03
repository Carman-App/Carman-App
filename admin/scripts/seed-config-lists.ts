/**
 * One-off seed for CFG-03's ConfigList/ConfigListItem rows. Creates the
 * seven lists AGENTS.md names (record_categories, document_types,
 * service_intervals, job_types, towns, cancellation_reasons, report_reasons)
 * with either real starter items lifted from the mobile app's hardcoded
 * data (record_categories from mobile/src/features/record/categories.ts,
 * document_types from mobile/src/types/domain.ts's DocumentType union,
 * cancellation_reasons from this schema's own CancellationReason enum) or a
 * reasonable placeholder starter set where no such source exists in mobile
 * today (service_intervals, job_types, towns, report_reasons — none of
 * these are hardcoded anywhere in mobile/src, so there is nothing "real" to
 * lift; these are honest starting points for an admin to edit, not
 * mirrored from a live source).
 *
 * Never writes to mobile/src — read-only reference there, per AGENTS.md.
 *
 * Usage: npx tsx scripts/seed-config-lists.ts
 */
import "../load-env";
import { PrismaClient } from "../src/generated/prisma/client";
import type { Prisma } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { withLibpqSsl } from "../src/lib/db-url";

type SeedItem = { code: string; label: string; sortOrder: number; metadata?: Record<string, unknown> };
type SeedList = { key: string; label: string; items: SeedItem[] };

const LISTS: SeedList[] = [
  {
    key: "record_categories",
    label: "Record categories",
    // Mirrors mobile/src/features/record/categories.ts's RECORD_CATEGORIES keys/labels.
    items: [
      { code: "fuel", label: "Fuel", sortOrder: 0 },
      { code: "service", label: "Service", sortOrder: 1 },
      { code: "repair", label: "Repair", sortOrder: 2 },
      { code: "part", label: "Parts", sortOrder: 3 },
      { code: "insurance", label: "Insurance", sortOrder: 4 },
    ],
  },
  {
    key: "document_types",
    label: "Document types",
    // Mirrors mobile/src/types/domain.ts's DocumentType union.
    items: [
      { code: "insurance", label: "Insurance", sortOrder: 0 },
      { code: "logbook", label: "Logbook", sortOrder: 1 },
      { code: "inspection", label: "Inspection", sortOrder: 2 },
      { code: "invoice", label: "Invoice", sortOrder: 3 },
      { code: "receipt", label: "Receipt", sortOrder: 4 },
    ],
  },
  {
    key: "service_intervals",
    label: "Service intervals by vehicle class",
    // No hardcoded source in mobile — placeholder starter set using the
    // metadata shape AGENTS.md specifies: { vehicleClass, intervalKm, intervalMonths }.
    items: [
      { code: "car_standard", label: "Car — standard service", sortOrder: 0, metadata: { vehicleClass: "CAR", intervalKm: 10000, intervalMonths: 6 } },
      { code: "motorcycle_standard", label: "Motorcycle — standard service", sortOrder: 1, metadata: { vehicleClass: "MOTORCYCLE", intervalKm: 6000, intervalMonths: 6 } },
    ],
  },
  {
    key: "job_types",
    label: "Job types",
    // No JobType enum/field exists on Job today (faultDescription is
    // freeform) — placeholder starter categories for future use.
    items: [
      { code: "general_service", label: "General service", sortOrder: 0 },
      { code: "diagnostic", label: "Diagnostic", sortOrder: 1 },
      { code: "brakes", label: "Brakes", sortOrder: 2 },
      { code: "tyres_wheels", label: "Tyres & wheels", sortOrder: 3 },
      { code: "electrical", label: "Electrical", sortOrder: 4 },
      { code: "bodywork", label: "Bodywork & panel", sortOrder: 5 },
    ],
  },
  {
    key: "towns",
    label: "Towns",
    // No hardcoded town list in mobile (placesCatalog.ts has named places,
    // not towns) — placeholder starter set of Nairobi-area localities.
    items: [
      { code: "nairobi_cbd", label: "Nairobi CBD", sortOrder: 0 },
      { code: "westlands", label: "Westlands", sortOrder: 1 },
      { code: "karen", label: "Karen", sortOrder: 2 },
      { code: "kilimani", label: "Kilimani", sortOrder: 3 },
      { code: "lavington", label: "Lavington", sortOrder: 4 },
    ],
  },
  {
    key: "cancellation_reasons",
    label: "Cancellation reasons",
    // Mirrors this schema's own CancellationReason enum (Subscription.cancellationReason).
    items: [
      { code: "too_expensive", label: "Too expensive", sortOrder: 0 },
      { code: "missing_feature", label: "Missing feature", sortOrder: 1 },
      { code: "switched_competitor", label: "Switched to a competitor", sortOrder: 2 },
      { code: "no_longer_needed", label: "No longer needed", sortOrder: 3 },
      { code: "technical_issues", label: "Technical issues", sortOrder: 4 },
      { code: "other", label: "Other", sortOrder: 5 },
    ],
  },
  {
    key: "report_reasons",
    label: "Report reasons",
    // AbuseReport.reason is freeform text today — placeholder starter
    // categories a mobile "report" UI could eventually pick from.
    items: [
      { code: "spam", label: "Spam", sortOrder: 0 },
      { code: "harassment", label: "Harassment or abuse", sortOrder: 1 },
      { code: "fraud", label: "Fraud or scam", sortOrder: 2 },
      { code: "inappropriate_content", label: "Inappropriate content", sortOrder: 3 },
      { code: "other", label: "Other", sortOrder: 4 },
    ],
  },
];

async function main() {
  const adapter = new PrismaPg({ connectionString: withLibpqSsl(process.env.DATABASE_URL ?? "") });
  const prisma = new PrismaClient({ adapter });

  try {
    for (const seedList of LISTS) {
      const list = await prisma.configList.upsert({
        where: { key: seedList.key },
        update: { label: seedList.label },
        create: { key: seedList.key, label: seedList.label },
      });

      for (const item of seedList.items) {
        await prisma.configListItem.upsert({
          where: { listId_code: { listId: list.id, code: item.code } },
          update: {
            label: item.label,
            sortOrder: item.sortOrder,
            metadata: (item.metadata as Prisma.InputJsonValue) ?? undefined,
          },
          create: {
            listId: list.id,
            code: item.code,
            label: item.label,
            sortOrder: item.sortOrder,
            metadata: (item.metadata as Prisma.InputJsonValue) ?? undefined,
          },
        });
      }

      console.log(`Seeded "${seedList.key}" (${seedList.items.length} items).`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
