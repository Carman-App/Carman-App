import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { QueryBoundary } from '@/components/data/QueryBoundary';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { IconGlyph } from '@/components/ui/IconGlyph';
import { Screen } from '@/components/ui/Screen';
import { T } from '@/components/ui/Typography';
import { TopBar } from '@/components/ui/TopBar';
import { useCurrency, useRecords, useVehicle } from '@/data/hooks';
import { formatMonthYear, formatNumber } from '@/lib/format';
import { recordTitle, sortRecords } from '@/lib/records';
import { CategoryColors, Colors, FontFamily, Radius, Spacing, Tracking } from '@/theme/tokens';
import type { VehicleRecord } from '@/types/domain';

type Filter = 'all' | 'fuel' | 'service' | 'docs' | 'readings';

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'fuel', label: 'Fuel' },
  { key: 'service', label: 'Service & repair' },
  { key: 'docs', label: 'Expenses' },
  { key: 'readings', label: 'Readings' },
];

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

function tint(r: VehicleRecord) {
  if (r.type === 'fuel') return CategoryColors.fuel;
  if (r.type === 'service') return CategoryColors.service;
  if (r.type === 'repair' || r.type === 'part') return CategoryColors.repair;
  if (r.type === 'odometer') return CategoryColors.odometer;
  if (r.category === 'insurance') return CategoryColors.insurance;
  return CategoryColors.other;
}

/** Timeline: every record for one car, by month, searchable by place, part or amount. */
export default function TimelineScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const vehicle = useVehicle(id).data;
  const recordsQuery = useRecords(id);
  const records = useMemo(() => sortRecords(recordsQuery.data), [recordsQuery.data]);
  const currency = useCurrency();
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const shown = records.filter((r) => {
      if (filter === 'fuel' && r.type !== 'fuel') return false;
      if (filter === 'service' && !['service', 'repair', 'part'].includes(r.type)) return false;
      if (filter === 'docs' && r.type !== 'expense') return false;
      if (filter === 'readings' && r.type !== 'odometer') return false;
      if (!q) return true;
      return [recordTitle(r), r.place, r.notes, String(r.amount), r.enteredByMemberName].some((s) => s?.toLowerCase().includes(q));
    });
    const map = new Map<string, VehicleRecord[]>();
    for (const r of shown) map.set(r.date.slice(0, 7), [...(map.get(r.date.slice(0, 7)) ?? []), r]);
    return Array.from(map.entries()).map(([month, items]) => ({ month, items, total: items.reduce((s, r) => s + r.amount, 0) }));
  }, [records, filter, query]);

  return (
    <Screen padded={false} header={<TopBar backLabel="VEHICLE" right={vehicle ? `${vehicle.model.toUpperCase()} · ${records.length} RECORDS` : undefined} />}>
      <View style={styles.pad}>
        <T variant="display" style={styles.title}>
          Timeline
        </T>
        <View style={styles.search}>
          <IconGlyph glyph="search" size={22} bg="transparent" fg={Colors.slate} scale={0.85} />
          <TextInput value={query} onChangeText={setQuery} placeholder="Place, part or amount" placeholderTextColor={Colors.textMuted} style={styles.searchInput} />
        </View>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
        {FILTERS.map((f) => (
          <Pressable key={f.key} onPress={() => setFilter(f.key)} style={[styles.filter, filter === f.key && styles.filterOn]}>
            <T style={[styles.filterText, filter === f.key && { color: Colors.accent, fontFamily: FontFamily.bold }]}>{f.label.toUpperCase()}</T>
          </Pressable>
        ))}
      </ScrollView>
      <QueryBoundary query={recordsQuery} isEmpty={() => false}>
        {() =>
          records.length === 0 ? (
            <EmptyState glyph="timeline" title="Nothing on the record yet." body="Log the next fill or service and it lands here, dated and priced, with the odometer reading attached.">
              <Button style={{ minWidth: 220, marginTop: Spacing.md }} onPress={() => router.push({ pathname: '/record/add', params: { vehicleId: id } })}>
                Log your first record
              </Button>
            </EmptyState>
          ) : groups.length === 0 ? (
            <T variant="meta" style={styles.pad}>
              Nothing matches.
            </T>
          ) : (
            groups.map((g) => (
              <View key={g.month}>
                <View style={styles.band}>
                  <T variant="eyebrowStrong">{formatMonthYear(g.month)}</T>
                  <T variant="eyebrowStrong" color={Colors.slate}>
                    {currency} {formatNumber(g.total)}
                  </T>
                </View>
                {g.items.map((r) => {
                  const d = new Date(r.date + 'T00:00:00');
                  const c = tint(r);
                  return (
                    <Pressable key={r.id} onPress={() => router.push(`/record/${r.id}/edit`)} style={({ pressed }) => [styles.row, pressed && { backgroundColor: '#F7F5F2' }]}>
                      <View style={styles.date}>
                        <T variant="small" color={Colors.ink}>
                          {d.getDate()}
                        </T>
                        <T variant="eyebrow">{MONTHS[d.getMonth()]}</T>
                      </View>
                      <View style={[styles.tile, { backgroundColor: c.bg }]} />
                      <View style={styles.flex}>
                        <T variant="bodyStrong">{recordTitle(r)}</T>
                        <T variant="eyebrow" color={Colors.slate} style={styles.sub}>
                          {[r.place, r.odometerAtEntry ? `${formatNumber(r.odometerAtEntry)} KM` : null].filter(Boolean).join(' · ')}
                        </T>
                        <T variant="eyebrow" color={Colors.textFaint}>
                          ENTERED BY {r.enteredByMemberName.toUpperCase()}
                        </T>
                      </View>
                      {r.amount ? <T variant="small" color={Colors.ink}>{formatNumber(r.amount)}</T> : null}
                    </Pressable>
                  );
                })}
              </View>
            ))
          )
        }
      </QueryBoundary>
    </Screen>
  );
}

const styles = StyleSheet.create({
  pad: {
    paddingHorizontal: Spacing.lg,
  },
  title: {
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 52,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.line,
    paddingHorizontal: Spacing.md,
  },
  searchInput: {
    flex: 1,
    fontFamily: FontFamily.medium,
    fontSize: 14,
    color: Colors.ink,
  },
  filters: {
    gap: 18,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
  },
  filter: {
    paddingBottom: 10,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  filterOn: {
    borderBottomColor: Colors.accent,
  },
  filterText: {
    fontSize: 10,
    letterSpacing: Tracking.label,
    color: Colors.slate,
  },
  band: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: 10,
    backgroundColor: Colors.surfaceWarm,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: Colors.borderSoft,
  },
  date: {
    width: 30,
    gap: 2,
  },
  tile: {
    width: 22,
    height: 22,
    borderRadius: 6,
    marginTop: 1,
  },
  flex: {
    flex: 1,
  },
  sub: {
    marginTop: 6,
    marginBottom: 4,
  },
});
