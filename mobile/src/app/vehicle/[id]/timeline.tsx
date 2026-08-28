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
import { useGarageMembers, useRecords, useVehicle } from '@/data/hooks';
import { formatDateShort, formatDateWithYear, formatMoney, formatMonthYear, formatNumber } from '@/lib/format';
import type { VehicleRecord } from '@/types/domain';
import { Colors, Spacing } from '@/theme/tokens';

type Filter = 'all' | 'service' | 'repairs' | 'fuel' | 'docs';

export default function VehicleTimelineScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const vehicleQuery = useVehicle(id);
  const vehicle = vehicleQuery.data;
  const recordsQuery = useRecords(id);
  const records = useMemo(() => recordsQuery.data ?? [], [recordsQuery.data]);
  const members = useGarageMembers(vehicle?.garageId).data ?? [];
  const [filter, setFilter] = useState<Filter>('all');

  const ownerName = members.find((m) => m.role === 'owner')?.name;

  const filtered = useMemo(() => {
    if (filter === 'service') return records.filter((r) => r.type === 'service');
    if (filter === 'repairs') return records.filter((r) => r.type === 'repair');
    if (filter === 'fuel') return records.filter((r) => r.type === 'fuel');
    if (filter === 'docs') return records.filter((r) => r.type === 'part' || r.type === 'expense');
    return records;
  }, [records, filter]);

  // Grouped by calendar month (newest first), each with a running subtotal —
  // matches the prototype's TIMELINE screen (month header + "KES n,nnn" next to it).
  const monthGroups = useMemo(() => {
    const map = new Map<string, VehicleRecord[]>();
    for (const r of filtered) {
      const key = r.date.slice(0, 7); // YYYY-MM
      const list = map.get(key) ?? [];
      list.push(r);
      map.set(key, list);
    }
    return Array.from(map.entries())
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .map(([month, items]) => ({
        month,
        items,
        subtotal: items.reduce((sum, r) => sum + r.amount, 0),
      }));
  }, [filtered]);

  // Header (make/model, "added to Carma" date) needs the vehicle; the list
  // needs records — the page is meaningless without both, so they gate
  // loading/error together.
  const primaryQuery = useMemo(
    () => ({
      data: vehicle && recordsQuery.data ? ({ vehicle, records: recordsQuery.data } as const) : undefined,
      isLoading: vehicleQuery.isLoading || recordsQuery.isLoading,
      isError: vehicleQuery.isError || recordsQuery.isError,
      error: vehicleQuery.error ?? recordsQuery.error,
      refetch: () => {
        vehicleQuery.refetch();
        recordsQuery.refetch();
      },
    }),
    [vehicle, recordsQuery, vehicleQuery]
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
        {records.length === 0 ? 'NO RECORDS YET' : `${records.length} EVENT${records.length === 1 ? '' : 'S'} · SINCE ${formatDateWithYear(vehicle.createdAt).toUpperCase()}`}
      </T>
      <T variant="display" style={styles.title}>
        Timeline
      </T>

      {records.length === 0 ? (
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
                {items.map((r, i) => (
                  <ListRow
                    key={r.id}
                    bordered={i < items.length - 1}
                    left={
                      <View style={styles.dateBadge}>
                        <T variant="meta" style={styles.dateDay}>
                          {formatDateShort(r.date).split(' ')[0]}
                        </T>
                        <T variant="meta">{formatDateShort(r.date).split(' ')[1]}</T>
                      </View>
                    }
                    title={recordTitle(r.type, r.litres)}
                    subtitle={recordSubtitle(r, ownerName)}
                    onPress={() => router.push(`/record/${r.id}/edit`)}
                    style={styles.row}
                    right={<T variant="bodyStrong">{formatMoney(r.amount, '')}</T>}
                  />
                ))}
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

function recordTitle(type: string, litres?: number) {
  if (type === 'fuel') return litres ? `Fuel · ${litres} L` : 'Fuel';
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
  const odo = `${formatNumber(r.odometerAtEntry)} KM`;
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
