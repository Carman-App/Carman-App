import "server-only";
import { prismaRead as prisma } from "@/lib/prisma";
import { daysAgo } from "./period";

// DATA-05 — storage per account. Document counts are fully real. Byte totals
// are not: Document.fileSizeBytes is null for essentially every row today —
// nothing in the mobile app sends it yet (see prisma/schema.prisma's
// Document.fileSizeBytes comment and src/lib/api/schemas.ts's
// createDocumentSchema). Every consumer of this module must show byte totals
// as "0 / not yet captured", not a bare "0", and must not rank accounts by
// bytes when there's no real byte data to rank on.

// Safety cap on the all-time per-account aggregation query below — this is an
// admin reporting surface, not a paginated table, so a single bounded fetch
// is simplest; if the platform ever has more non-deleted documents than
// this, the heaviest-accounts ranking below is computed from the most
// recently added MAX_DOCUMENTS_SCANNED only (still ordered newest-first, so
// it under-counts old accounts' history rather than silently misranking).
const MAX_DOCUMENTS_SCANNED = 20000;
const HEAVIEST_ACCOUNTS_LIMIT = 20;
const TREND_BUCKET_COUNT = 8;

export type AccountStorageRow = {
  accountId: string;
  accountName: string;
  documentCount: number;
  bytesKnownCount: number;
  bytesSum: number;
};

export type TrendBucket = { bucketStart: Date; bucketEnd: Date; count: number };

export type StorageReport = {
  scannedDocumentCount: number;
  scanTruncated: boolean;
  totalDocuments: number;
  totalBytesKnownCount: number;
  totalBytesSum: number;
  /** Ranked by document count — always meaningful, since counts are real. */
  heaviestByCount: AccountStorageRow[];
  /** Ranked by byte sum — null when no document anywhere has a known size, so there's nothing real to rank on. */
  heaviestByBytes: AccountStorageRow[] | null;
  /** Document-count trend over the selected period, bucketed. Always counts-based (see module comment). */
  trend: TrendBucket[];
};

export async function getStorageReport(trendDays: number): Promise<StorageReport> {
  const [totalDocuments, documents] = await Promise.all([
    prisma.document.count({ where: { deletedAt: null } }),
    prisma.document.findMany({
      where: { deletedAt: null },
      select: {
        fileSizeBytes: true,
        addedAt: true,
        vehicle: { select: { garage: { select: { owner: { select: { id: true, user: { select: { name: true } } } } } } } },
      },
      orderBy: { addedAt: "desc" },
      take: MAX_DOCUMENTS_SCANNED,
    }),
  ]);

  const byAccount = new Map<string, { name: string; count: number; bytesKnown: number; bytesSum: number }>();
  let totalBytesKnownCount = 0;
  let totalBytesSum = 0;

  for (const doc of documents) {
    const ownerId = doc.vehicle.garage.owner.id;
    const entry = byAccount.get(ownerId) ?? { name: doc.vehicle.garage.owner.user.name, count: 0, bytesKnown: 0, bytesSum: 0 };
    entry.count += 1;
    if (doc.fileSizeBytes != null) {
      entry.bytesKnown += 1;
      entry.bytesSum += doc.fileSizeBytes;
      totalBytesKnownCount += 1;
      totalBytesSum += doc.fileSizeBytes;
    }
    byAccount.set(ownerId, entry);
  }

  const rows: AccountStorageRow[] = [...byAccount.entries()].map(([accountId, v]) => ({
    accountId,
    accountName: v.name,
    documentCount: v.count,
    bytesKnownCount: v.bytesKnown,
    bytesSum: v.bytesSum,
  }));

  const heaviestByCount = rows
    .slice()
    .sort((a, b) => b.documentCount - a.documentCount)
    .slice(0, HEAVIEST_ACCOUNTS_LIMIT);

  const heaviestByBytes =
    totalBytesKnownCount === 0
      ? null
      : rows
          .filter((r) => r.bytesKnownCount > 0)
          .sort((a, b) => b.bytesSum - a.bytesSum)
          .slice(0, HEAVIEST_ACCOUNTS_LIMIT);

  const trend = await getDocumentCountTrend(trendDays);

  return {
    scannedDocumentCount: documents.length,
    scanTruncated: totalDocuments > documents.length,
    totalDocuments,
    totalBytesKnownCount,
    totalBytesSum,
    heaviestByCount,
    heaviestByBytes,
    trend,
  };
}

/** Simple equal-width bucketed count of documents added in the last `days` days — counts-based since bytes aren't real yet (see module comment). */
async function getDocumentCountTrend(days: number): Promise<TrendBucket[]> {
  const since = daysAgo(days);
  const docs = await prisma.document.findMany({
    where: { deletedAt: null, addedAt: { gte: since } },
    select: { addedAt: true },
  });

  const totalMs = Date.now() - since.getTime();
  const bucketMs = totalMs / TREND_BUCKET_COUNT;
  const buckets: TrendBucket[] = Array.from({ length: TREND_BUCKET_COUNT }, (_, i) => ({
    bucketStart: new Date(since.getTime() + i * bucketMs),
    bucketEnd: new Date(since.getTime() + (i + 1) * bucketMs),
    count: 0,
  }));

  for (const doc of docs) {
    const idx = Math.min(TREND_BUCKET_COUNT - 1, Math.floor((doc.addedAt.getTime() - since.getTime()) / bucketMs));
    if (idx >= 0) buckets[idx].count += 1;
  }

  return buckets;
}
