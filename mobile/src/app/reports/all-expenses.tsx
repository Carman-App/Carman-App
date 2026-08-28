import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { EmptyState } from '@/components/ui/EmptyState';
import { ListRow } from '@/components/ui/ListRow';
import { Screen } from '@/components/ui/Screen';
import { T } from '@/components/ui/Typography';
import { QueryBoundary } from '@/components/data/QueryBoundary';
import { useActiveGarage, useGarageRecords } from '@/data/hooks';
import { formatDateShort, formatMoney, formatNumber } from '@/lib/format';
import type { VehicleRecord } from '@/types/domain';
import { Colors, Spacing } from '@/theme/tokens';

type Filter = 'all' | 'fuel' | 'service' | 'repair' | 'other';

// Stable empty-array reference (rather than a fresh `[]` literal every render
// while the query is loading) so the `useMemo` below doesn't get a "changes
// every render" lint warning purely from the loading-state fallback.
const EMPTY_RECORDS: VehicleRecord[] = [];

const CATEGORY_LABEL: Record<string, string> = {
  fuel: 'Fuel',
  service: 'Service',
  insurance: 'Insurance',
  loan: 'Loan',
  other: 'Other',
};

/** Matches the prototype's ALL EXPENSES screen: garage-wide record list with a
 * running total, ALL/FUEL/SERVICE/REPAIR/OTHER filters, and a descriptive
 * title + date/detail subtitle per row. Reached from the Garage home's
 * "Latest N of X" section — the vehicle Timeline (per-vehicle, different
 * structure) is left untouched. */
export default function AllExpensesScreen() {
  const garageQuery = useActiveGarage();
  const recordsQuery = useGarageRecords(garageQuery.data?.id);
  const records = recordsQuery.data ?? EMPTY_RECORDS;
  const [filter, setFilter] = useState<Filter>('all');

  const year = new Date().getFullYear();
  const thisYear = useMemo(() => records.filter((r) => new Date(r.date + 'T00:00:00').getFullYear() === year), [records, year]);

  const filtered = useMemo(() => {
    if (filter === 'fuel') return thisYear.filter((r) => r.type === 'fuel');
    if (filter === 'service') return thisYear.filter((r) => r.type === 'service');
    if (filter === 'repair') return thisYear.filter((r) => r.type === 'repair' || r.type === 'part');
    if (filter === 'other') return thisYear.filter((r) => !['fuel', 'service', 'repair', 'part'].includes(r.type));
    return thisYear;
  }, [thisYear, filter]);

  const total = thisYear.reduce((sum, r) => sum + r.amount, 0);

  return (
    <Screen scroll contentStyle={styles.content}>
      <Pressable onPress={() => router.back()}>
        <T variant="eyebrowStrong" color={Colors.accent}>
          ← BACK
        </T>
      </Pressable>

      <T variant="eyebrow" style={styles.eyebrow}>
        ALL EXPENSES
      </T>

      <QueryBoundary query={recordsQuery} isEmpty={() => false}>
        {() => (
          <>
            <T variant="numericLarge">{formatMoney(total)}</T>
            <T variant="meta" style={styles.subtitle}>
              THIS YEAR · {thisYear.length} RECORD{thisYear.length === 1 ? '' : 'S'}
            </T>

            {thisYear.length === 0 ? (
              <EmptyState
                glyph="expense"
                title="No expenses yet this year."
                body="Every fill, service and receipt you log across the garage lands here, with a running total for the year."
              />
            ) : (
              <>
                <View style={styles.filterRow}>
                  <Chip label="All" selected={filter === 'all'} onPress={() => setFilter('all')} />
                  <Chip label="Fuel" selected={filter === 'fuel'} onPress={() => setFilter('fuel')} />
                  <Chip label="Service" selected={filter === 'service'} onPress={() => setFilter('service')} />
                  <Chip label="Repair" selected={filter === 'repair'} onPress={() => setFilter('repair')} />
                  <Chip label="Other" selected={filter === 'other'} onPress={() => setFilter('other')} />
                </View>

                <Card padded={false} style={styles.listCard}>
                  {filtered.map((r, i) => (
                    <ListRow
                      key={r.id}
                      bordered={i < filtered.length - 1}
                      title={recordTitle(r)}
                      subtitle={recordSubtitle(r)}
                      onPress={() => router.push(`/record/${r.id}/edit`)}
                      style={styles.row}
                      right={<T variant="bodyStrong">{formatMoney(r.amount)}</T>}
                    />
                  ))}
                  {filtered.length === 0 ? (
                    <T variant="meta" style={styles.emptyFilter}>
                      No records in this category.
                    </T>
                  ) : null}
                </Card>
              </>
            )}
          </>
        )}
      </QueryBoundary>

      <T variant="meta" center style={styles.footnote}>
        FILTER BY VEHICLE, CATEGORY, DATE RANGE, MECHANIC OR AMOUNT.
      </T>
    </Screen>
  );
}

function recordTitle(r: VehicleRecord): string {
  if (r.type === 'fuel') return r.place || 'Fuel';
  if (r.notes) return r.notes;
  if (r.type === 'service') return 'Service';
  if (r.type === 'repair') return 'Repair';
  if (r.type === 'part') return 'Part';
  if (r.type === 'odometer') return 'Odometer reading';
  return CATEGORY_LABEL[r.category ?? 'other'] ?? 'Expense';
}

function recordSubtitle(r: VehicleRecord): string {
  const date = formatDateShort(r.date);
  if (r.type === 'fuel') return `${date} · ${r.litres ?? '—'} L · ${formatNumber(r.odometerAtEntry)} KM`;
  if (r.place) return `${date} · ${r.place.toUpperCase()}`;
  return date;
}

const styles = StyleSheet.create({
  content: {
    paddingTop: Spacing.sm,
  },
  eyebrow: {
    marginTop: Spacing.md,
  },
  subtitle: {
    marginTop: 2,
    marginBottom: Spacing.md,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginBottom: Spacing.md,
  },
  listCard: {
    padding: Spacing.sm,
  },
  row: {
    paddingHorizontal: Spacing.sm,
  },
  emptyFilter: {
    padding: Spacing.md,
  },
  footnote: {
    marginTop: Spacing.lg,
    marginBottom: Spacing.md,
  },
});
