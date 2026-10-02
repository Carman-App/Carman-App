import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { EmptyState } from '@/components/ui/EmptyState';
import { ListRow } from '@/components/ui/ListRow';
import { Screen } from '@/components/ui/Screen';
import { T } from '@/components/ui/Typography';
import { QueryBoundary } from '@/components/data/QueryBoundary';
import { useDocuments, useGarageMembers, useRecords, useVehicle } from '@/data/hooks';
import { formatDateShort, formatDateWithYear, formatDistance, formatMoney, formatMonthYear, formatVolume } from '@/lib/format';
import type { VehicleDocument, VehicleRecord } from '@/types/domain';
import { Colors, Spacing } from '@/theme/tokens';

type Filter = 'all' | 'service' | 'repairs' | 'fuel' | 'docs';

// A single row on the timeline is either a self-entered record or a stored
// document — merged so "Docs" actually shows documents (insurance, logbook,
// receipts, ...) instead of misfiring on 'part'/'expense' records, which
// aren't documents at all. `date` is the sort/group key for both.
type TimelineEntry =
  | { kind: 'record'; date: string; record: VehicleRecord }
  | { kind: 'document'; date: string; document: VehicleDocument };

export default function VehicleTimelineScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const vehicleQuery = useVehicle(id);
  const vehicle = vehicleQuery.data;
  const recordsQuery = useRecords(id);
  const records = useMemo(() => recordsQuery.data ?? [], [recordsQuery.data]);
  const documentsQuery = useDocuments(id);
  const documents = useMemo(() => documentsQuery.data ?? [], [documentsQuery.data]);
  const members = useGarageMembers(vehicle?.garageId).data ?? [];
  const [filter, setFilter] = useState<Filter>('all');

  const ownerName = members.find((m) => m.role === 'owner')?.name;

  const entries = useMemo<TimelineEntry[]>(
    () => [
      ...records.map((record): TimelineEntry => ({ kind: 'record', date: record.date, record })),
      ...documents.map((document): TimelineEntry => ({ kind: 'document', date: document.addedAt, document })),
    ],
    [records, documents]
  );

  const filtered = useMemo(() => {
    if (filter === 'service') return entries.filter((e) => e.kind === 'record' && e.record.type === 'service');
    if (filter === 'repairs') return entries.filter((e) => e.kind === 'record' && e.record.type === 'repair');
    if (filter === 'fuel') return entries.filter((e) => e.kind === 'record' && e.record.type === 'fuel');
    if (filter === 'docs') return entries.filter((e) => e.kind === 'document');
    return entries;
  }, [entries, filter]);

  // Grouped by calendar month (newest first), each with a running subtotal —
  // matches the prototype's TIMELINE screen (month header + "KES n,nnn" next to it).
  // Documents don't carry an amount, so they don't add to the subtotal.
  const monthGroups = useMemo(() => {
    const map = new Map<string, TimelineEntry[]>();
    for (const e of filtered) {
      const key = e.date.slice(0, 7); // YYYY-MM
      const list = map.get(key) ?? [];
      list.push(e);
      map.set(key, list);
    }
    return Array.from(map.entries())
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .map(([month, items]) => ({
        month,
        items,
        subtotal: items.reduce((sum, e) => sum + (e.kind === 'record' ? e.record.amount : 0), 0),
      }));
  }, [filtered]);

  // Header (make/model, "added to Carma" date) needs the vehicle; the list
  // needs records and documents — the page is meaningless without all three,
  // so they gate loading/error together.
  const primaryQuery = useMemo(
    () => ({
      data:
        vehicle && recordsQuery.data && documentsQuery.data
          ? ({ vehicle, records: recordsQuery.data, documents: documentsQuery.data } as const)
          : undefined,
      isLoading: vehicleQuery.isLoading || recordsQuery.isLoading || documentsQuery.isLoading,
      isError: vehicleQuery.isError || recordsQuery.isError || documentsQuery.isError,
      error: vehicleQuery.error ?? recordsQuery.error ?? documentsQuery.error,
      refetch: () => {
        vehicleQuery.refetch();
        recordsQuery.refetch();
        documentsQuery.refetch();
      },
    }),
    [vehicle, recordsQuery, documentsQuery, vehicleQuery]
  );

  return (
    <Screen scroll contentStyle={styles.content}>
      <QueryBoundary query={primaryQuery} isEmpty={() => false}>
        {({ vehicle }) => (
          <>
      <Pressable onPress={() => router.back()}>
        <T variant="eyebrowStrong" color={Colors.accent}>
          ← {vehicle.make.toUpperCase()} {vehicle.model.toUpperCase()}
        </T>
      </Pressable>

      <T variant="eyebrow" style={styles.count}>
        {entries.length === 0 ? 'NO RECORDS YET' : `${entries.length} EVENT${entries.length === 1 ? '' : 'S'} · SINCE ${formatDateWithYear(vehicle.createdAt).toUpperCase()}`}
      </T>
      <T variant="display" style={styles.title}>
        Timeline
      </T>

      {entries.length === 0 ? (
        <EmptyState
          glyph="timeline"
          title="Nothing on the record yet."
          body="The timeline fills itself as you go. Log the next fill or service and it lands here, dated and priced, with the odometer reading attached.">
          <Button style={styles.emptyCta} onPress={() => router.push({ pathname: '/record/add', params: { vehicleId: id } })}>
            Log your first record
          </Button>
        </EmptyState>
      ) : (
        <>
          <View style={styles.filterRow}>
            <Chip label="All" selected={filter === 'all'} onPress={() => setFilter('all')} />
            <Chip label="Service" selected={filter === 'service'} onPress={() => setFilter('service')} />
            <Chip label="Repairs" selected={filter === 'repairs'} onPress={() => setFilter('repairs')} />
            <Chip label="Fuel" selected={filter === 'fuel'} onPress={() => setFilter('fuel')} />
            <Chip label="Docs" selected={filter === 'docs'} onPress={() => setFilter('docs')} />
          </View>

          {monthGroups.map(({ month, items, subtotal }) => (
            <View key={month} style={styles.group}>
              <View style={styles.monthHeader}>
                <T variant="eyebrow">{formatMonthYear(month)}</T>
                <T variant="bodyStrong">{formatMoney(subtotal)}</T>
              </View>
              <Card padded={false} style={styles.groupCard}>
                {items.map((entry, i) => {
                  const dateBadge = (
                    <View style={styles.dateBadge}>
                      <T variant="meta" style={styles.dateDay}>
                        {formatDateShort(entry.date).split(' ')[0]}
                      </T>
                      <T variant="meta">{formatDateShort(entry.date).split(' ')[1]}</T>
                    </View>
                  );
                  if (entry.kind === 'document') {
                    const d = entry.document;
                    return (
                      <ListRow
                        key={`doc-${d.id}`}
                        bordered={i < items.length - 1}
                        left={dateBadge}
                        title={d.title}
                        subtitle={documentSubtitle(d)}
                        onPress={() => router.push(`/doc/${d.id}`)}
                        style={styles.row}
                        right={<T variant="meta" color={Colors.textMuted}>DOC</T>}
                      />
                    );
                  }
                  const r = entry.record;
                  return (
                    <ListRow
                      key={r.id}
                      bordered={i < items.length - 1}
                      left={dateBadge}
                      title={recordTitle(r.type, r.litres)}
                      subtitle={recordSubtitle(r, ownerName)}
                      onPress={() => router.push(`/record/${r.id}/edit`)}
                      style={styles.row}
                      right={<T variant="bodyStrong">{formatMoney(r.amount, '')}</T>}
                    />
                  );
                })}
              </Card>
            </View>
          ))}

          <T variant="meta" center style={styles.footnote}>
            VEHICLE ADDED TO CARMA · {formatDateWithYear(vehicle.createdAt)}
          </T>
        </>
      )}
          </>
        )}
      </QueryBoundary>
    </Screen>
  );
}

const DOCUMENT_TYPE_LABEL: Record<VehicleDocument['type'], string> = {
  insurance: 'Insurance',
  logbook: 'Logbook',
  inspection: 'Inspection report',
  invoice: 'Invoice',
  receipt: 'Receipt',
};

function documentSubtitle(d: VehicleDocument): string {
  const kind = DOCUMENT_TYPE_LABEL[d.type].toUpperCase();
  return d.expiryDate ? `${kind} · EXPIRES ${formatDateShort(d.expiryDate).toUpperCase()}` : kind;
}

function recordTitle(type: string, litres?: number) {
  if (type === 'fuel') return litres ? `Fuel · ${formatVolume(litres)}` : 'Fuel';
  if (type === 'service') return 'Service';
  if (type === 'repair') return 'Repair';
  if (type === 'part') return 'Part';
  if (type === 'odometer') return 'Odometer reading';
  return 'Expense';
}

/** Richer, category-aware subtitle: the place/detail line, then a second
 * "ADDED BY X" line when someone other than the garage owner logged it —
 * matching the prototype's TIMELINE row structure. */
function recordSubtitle(r: VehicleRecord, ownerName?: string): string {
  const odo = formatDistance(r.odometerAtEntry);
  let detail: string;
  if (r.type === 'fuel') {
    detail = r.place ? `${r.place.toUpperCase()} · FULL TANK · ${odo}` : `FULL TANK · ${odo}`;
  } else if (r.type === 'odometer') {
    detail = `ODOMETER READING · ${odo}`;
  } else if (r.notes) {
    detail = `${odo} · ${r.notes.toUpperCase()}`;
  } else if (r.place) {
    detail = `${odo} · ${r.place.toUpperCase()}`;
  } else {
    detail = odo;
  }
  const addedBy = r.enteredByMemberName && r.enteredByMemberName !== ownerName ? `\nADDED BY ${r.enteredByMemberName.split(' ')[0].toUpperCase()}` : '';
  return `${detail}${addedBy}`;
}

const styles = StyleSheet.create({
  content: {
    paddingTop: Spacing.sm,
  },
  count: {
    marginTop: Spacing.md,
  },
  title: {
    marginBottom: Spacing.sm,
  },
  emptyCta: {
    marginTop: Spacing.md,
    minWidth: 220,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginBottom: Spacing.lg,
  },
  group: {
    marginBottom: Spacing.md,
  },
  monthHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: Spacing.xs,
  },
  groupCard: {
    padding: Spacing.sm,
  },
  row: {
    paddingHorizontal: Spacing.sm,
  },
  dateBadge: {
    width: 34,
  },
  dateDay: {
    color: Colors.text,
  },
  footnote: {
    marginTop: Spacing.lg,
    marginBottom: Spacing.md,
  },
});
