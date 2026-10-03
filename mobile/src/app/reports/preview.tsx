import { useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { Share, StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { T } from '@/components/ui/Typography';
import { TopBar } from '@/components/ui/TopBar';
import { Dot, MoneyFigure } from '@/components/ui/Blocks';
import { QueryBoundary } from '@/components/data/QueryBoundary';
import { useActiveGarage, useCurrency, useGarageReminders, useGarageRecords, useReminders, useVehicles } from '@/data/hooks';
import { formatDateWithYear, formatMoney, formatPlate, todayIso } from '@/lib/format';
import type { Vehicle, VehicleRecord } from '@/types/domain';
import { Colors, Radius, Spacing } from '@/theme/tokens';

// Stable empty-array references so the `useMemo` hooks below that depend on
// `vehicles`/`allRecords` don't get a "changes every render" lint warning
// purely from the loading-state `?? []` fallback.
const EMPTY_VEHICLES: Vehicle[] = [];
const EMPTY_RECORDS: VehicleRecord[] = [];

const CATEGORY_GROUPS: { key: string; label: string; match: (r: VehicleRecord) => boolean }[] = [
  { key: 'fuel', label: 'Fuel and charging', match: (r) => r.category === 'fuel' },
  { key: 'service', label: 'Service', match: (r) => r.category === 'service' },
  { key: 'repair', label: 'Repairs and parts', match: (r) => r.type === 'repair' || r.type === 'part' },
  { key: 'insurance', label: 'Insurance and licences', match: (r) => r.category === 'insurance' },
  { key: 'other', label: 'Everything else', match: (r) => !['fuel', 'service', 'insurance'].includes(r.category ?? '') && r.type !== 'repair' && r.type !== 'part' },
];

function recordLabel(r: VehicleRecord) {
  if (r.type === 'fuel') return r.litres ? `Fuel · ${r.litres} L` : 'Fuel';
  if (r.type === 'service') return 'Service';
  if (r.type === 'repair') return 'Repair';
  if (r.type === 'part') return 'Part';
  if (r.type === 'odometer') return 'Odometer reading';
  return 'Expense';
}

export default function ReportPreviewScreen() {
  const { scope, vehicleId, start, end, place } = useLocalSearchParams<{
    scope?: string;
    vehicleId?: string;
    start?: string;
    end?: string;
    place?: string;
  }>();

  const garageQuery = useActiveGarage();
  const garage = garageQuery.data;
  const currency = useCurrency();
  const vehiclesQuery = useVehicles(garage?.id);
  const recordsQuery = useGarageRecords(garage?.id);
  const gRemindersQuery = useGarageReminders(garage?.id);
  const vRemindersQuery = useReminders(vehicleId);
  const vehicles = vehiclesQuery.data ?? EMPTY_VEHICLES;
  const allRecords = recordsQuery.data ?? EMPTY_RECORDS;
  const gReminders = gRemindersQuery.data ?? [];
  const vReminders = vRemindersQuery.data ?? [];

  const isVehicleScope = scope === 'vehicle' && !!vehicleId;
  const singleVehicle = isVehicleScope ? vehicles.find((v) => v.id === vehicleId) : undefined;

  const startD = start || `${new Date().getFullYear()}-01-01`;
  const endD = end || todayIso();

  const records = useMemo(() => {
    const scoped = isVehicleScope ? allRecords.filter((r) => r.vehicleId === vehicleId) : allRecords;
    const periodRecords = scoped.filter((r) => r.date >= startD && r.date <= endD);
    return place && place !== 'all' ? periodRecords.filter((r) => r.place === place) : periodRecords;
  }, [allRecords, isVehicleScope, vehicleId, startD, endD, place]);

  const total = records.reduce((s, r) => s + r.amount, 0);
  const monthsWithActivity = new Set(records.map((r) => r.date.slice(0, 7))).size || 1;
  const perMonth = total / monthsWithActivity;

  const categoryBreakdown = CATEGORY_GROUPS.map((g) => {
    const recs = records.filter(g.match);
    const amount = recs.reduce((s, r) => s + r.amount, 0);
    return { ...g, count: recs.length, amount, pct: total > 0 ? Math.round((amount / total) * 100) : 0 };
  }).filter((g) => g.count > 0);

  const serviceAmount = records.filter((r) => r.category === 'service').reduce((s, r) => s + r.amount, 0);
  const repairAmount = records.filter((r) => r.type === 'repair' || r.type === 'part').reduce((s, r) => s + r.amount, 0);
  const plannedTakeaway =
    serviceAmount === 0 && repairAmount === 0
      ? 'No planned or unplanned spend in this period.'
      : serviceAmount >= repairAmount
        ? 'Planned maintenance outweighs unplanned repairs in this period.'
        : 'Unplanned repairs outweigh planned maintenance in this period — worth a closer look.';

  const costPerKm = isVehicleScope && singleVehicle && singleVehicle.odometerKm > 0 ? total / singleVehicle.odometerKm : null;

  const byVehicle = useMemo(() => {
    if (isVehicleScope) return [];
    return vehicles
      .map((v) => {
        const recs = records.filter((r) => r.vehicleId === v.id);
        const amount = recs.reduce((s, r) => s + r.amount, 0);
        return { vehicle: v, count: recs.length, amount, pct: total > 0 ? Math.round((amount / total) * 100) : 0 };
      })
      .filter((v) => v.count > 0)
      .sort((a, b) => b.amount - a.amount);
  }, [isVehicleScope, vehicles, records, total]);

  const whoSpentIt = useMemo(() => {
    const map = new Map<string, { count: number; amount: number }>();
    for (const r of records) {
      const key = r.enteredByMemberName || 'Unknown';
      const cur = map.get(key) ?? { count: 0, amount: 0 };
      cur.count += 1;
      cur.amount += r.amount;
      map.set(key, cur);
    }
    return Array.from(map.entries())
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.amount - a.amount);
  }, [records]);

  const byWorkshop = useMemo(() => {
    const map = new Map<string, { count: number; amount: number }>();
    for (const r of records) {
      const key = r.place || 'Unspecified';
      const cur = map.get(key) ?? { count: 0, amount: 0 };
      cur.count += 1;
      cur.amount += r.amount;
      map.set(key, cur);
    }
    return Array.from(map.entries())
      .map(([place2, v]) => ({ place: place2, ...v }))
      .sort((a, b) => b.amount - a.amount);
  }, [records]);

  const sortedByDate = [...records].sort((a, b) => (a.date < b.date ? -1 : 1));
  const firstDate = sortedByDate[0]?.date;
  const lastDate = sortedByDate[sortedByDate.length - 1]?.date;

  const dueReminders = (isVehicleScope ? vReminders : gReminders).filter(
    (r) => r.kind === 'service-due' || r.kind === 'document-expiry'
  );

  const vehicleById = new Map(vehicles.map((v) => [v.id, v] as const));

  const today = todayIso();
  const filenameTag = isVehicleScope ? (singleVehicle?.plate ?? 'VEHICLE').replace(/\s+/g, '') : 'GARAGE';
  const filename = `CARMA-${filenameTag}-${today.slice(0, 4)}.PDF`;

  const shareReport = () =>
    Share.share({
      title: filename,
      message: [
        `Carma expense report · ${isVehicleScope && singleVehicle ? `${singleVehicle.make} ${singleVehicle.model}` : 'Whole garage'}`,
        `${formatDateWithYear(startD)} – ${formatDateWithYear(endD)}`,
        `Total ${formatMoney(total)} · ${records.length} records`,
        ...categoryBreakdown.map((c) => `${c.label}: ${formatMoney(c.amount, '')} (${c.pct}%)`),
      ].join('\n'),
    });

  return (
    <Screen
      contentStyle={styles.content}
      header={<TopBar backLabel="EDIT" right={filename} />}
      footer={<Button glyph="share" onPress={shareReport}>Export or share</Button>}>
      <QueryBoundary query={recordsQuery} isEmpty={() => false}>
        {() => (
          <>
      <View style={styles.letterhead}>
        <View style={styles.brandRow}>
          <View style={styles.brand}>
            <Dot color={Colors.accent} size={8} />
            <T variant="eyebrow" color={Colors.body}>CARMA</T>
          </View>
          <T variant="eyebrow" color={Colors.body}>EXPENSE REPORT</T>
        </View>
        <T variant="display">
          {isVehicleScope && singleVehicle ? `${singleVehicle.make} ${singleVehicle.model}` : (garage?.name ?? 'Whole garage')}
        </T>
        <T variant="eyebrow" color={Colors.slate}>
          {isVehicleScope && singleVehicle
            ? `${singleVehicle.make} · ${singleVehicle.year} · ${formatPlate(singleVehicle.plate)}`
            : `${vehicles.length} VEHICLE${vehicles.length === 1 ? '' : 'S'}${garage?.location ? ` · ${garage.location.toUpperCase()}` : ''}`}
        </T>
        <View style={styles.letterRule} />
        <View style={styles.kv}>
          <T variant="eyebrow" color={Colors.slate}>PERIOD</T>
          <T variant="eyebrow" color={Colors.ink}>{formatDateWithYear(startD)} — {formatDateWithYear(endD)}</T>
        </View>
        <View style={styles.kv}>
          <T variant="eyebrow" color={Colors.slate}>SCOPE</T>
          <T variant="eyebrow" color={Colors.ink}>{isVehicleScope && singleVehicle ? singleVehicle.model : 'Whole garage'}</T>
        </View>
        <T variant="eyebrow" color={Colors.slate} style={styles.totalLabel}>TOTAL SPENT</T>
        <MoneyFigure amount={formatMoney(total, '')} />
      </View>

      <View style={styles.statGrid}>
        <View style={styles.statCard}>
          <T variant="eyebrow">TOTAL SPENT</T>
          <T variant="numeric">{formatMoney(total, '')}</T>
        </View>
        <View style={styles.statCard}>
          <T variant="eyebrow">RECORDS</T>
          <T variant="numeric">{records.length}</T>
        </View>
        <View style={styles.statCard}>
          <T variant="eyebrow">PER MONTH</T>
          <T variant="numeric">{formatMoney(perMonth, '')}</T>
        </View>
        <View style={styles.statCard}>
          <T variant="eyebrow">MONTHS ACTIVE</T>
          <T variant="numeric">{monthsWithActivity}</T>
        </View>
      </View>

      <SectionHeader title="By category" />
      <Card style={styles.sectionCard}>
        {categoryBreakdown.map((c, i) => (
          <View key={c.key} style={[styles.row, i > 0 && styles.rowBorder]}>
            <View style={styles.rowText}>
              <T variant="bodyStrong">{c.label}</T>
              <T variant="meta">
                {c.count} record{c.count === 1 ? '' : 's'} · {c.pct}%
              </T>
            </View>
            <T variant="bodyStrong">{formatMoney(c.amount, '')}</T>
          </View>
        ))}
        {categoryBreakdown.length === 0 ? <T variant="meta">No records in this period.</T> : null}
      </Card>

      <SectionHeader title="Planned against unplanned" />
      <Card style={styles.sectionCard}>
        <View style={styles.row}>
          <T variant="bodyStrong">Service (planned)</T>
          <T variant="bodyStrong">{formatMoney(serviceAmount, '')}</T>
        </View>
        <View style={[styles.row, styles.rowBorder]}>
          <T variant="bodyStrong">Repairs (unplanned)</T>
          <T variant="bodyStrong">{formatMoney(repairAmount, '')}</T>
        </View>
        <T variant="meta" style={styles.takeaway}>
          {plannedTakeaway}
        </T>
      </Card>

      <SectionHeader title="Cost per kilometre" />
      <Card style={styles.sectionCard}>
        {costPerKm != null ? (
          <>
            <T variant="numericLarge">{costPerKm.toFixed(2)}</T>
            <T variant="meta">{currency} PER KM</T>
          </>
        ) : (
          <T variant="meta" color={Colors.textMuted}>
            {isVehicleScope ? 'ODOMETER NOT SET FOR THIS VEHICLE.' : 'COST PER KILOMETRE IS WITHHELD ON A GARAGE REPORT.'}
          </T>
        )}
      </Card>

      {!isVehicleScope ? (
        <>
          <SectionHeader title="By vehicle" />
          <Card style={styles.sectionCard}>
            {byVehicle.map((v, i) => (
              <View key={v.vehicle.id} style={[styles.row, i > 0 && styles.rowBorder]}>
                <View style={styles.rowText}>
                  <T variant="bodyStrong">
                    {v.vehicle.make} {v.vehicle.model}
                  </T>
                  <T variant="meta">
                    {formatPlate(v.vehicle.plate)} · {v.count} record{v.count === 1 ? '' : 's'} · {v.pct}%
                  </T>
                </View>
                <T variant="bodyStrong">{formatMoney(v.amount, '')}</T>
              </View>
            ))}
            {byVehicle.length === 0 ? <T variant="meta">No records in this period.</T> : null}
          </Card>
        </>
      ) : null}

      <SectionHeader title="Who spent it" />
      <Card style={styles.sectionCard}>
        {whoSpentIt.map((w, i) => (
          <View key={w.name} style={[styles.row, i > 0 && styles.rowBorder]}>
            <Avatar name={w.name} size={32} />
            <View style={styles.rowText}>
              <T variant="bodyStrong">{w.name}</T>
              <T variant="meta">
                {w.count} record{w.count === 1 ? '' : 's'}
              </T>
            </View>
            <T variant="bodyStrong">{formatMoney(w.amount, '')}</T>
          </View>
        ))}
        {whoSpentIt.length === 0 ? <T variant="meta">No records in this period.</T> : null}
      </Card>

      <SectionHeader title="By workshop and vendor" />
      <Card style={styles.sectionCard}>
        {byWorkshop.map((w, i) => (
          <View key={w.place} style={[styles.row, i > 0 && styles.rowBorder]}>
            <View style={styles.rowText}>
              <T variant="bodyStrong">{w.place}</T>
              <T variant="meta">
                {w.count} visit{w.count === 1 ? '' : 's'}
              </T>
            </View>
            <T variant="bodyStrong">{formatMoney(w.amount, '')}</T>
          </View>
        ))}
        {byWorkshop.length === 0 ? <T variant="meta">No records in this period.</T> : null}
      </Card>

      <SectionHeader title="What this covers" />
      <Card style={styles.sectionCard}>
        <T variant="body">{firstDate ? `First record ${formatDateWithYear(firstDate)}` : 'No records in this period.'}</T>
        {lastDate ? <T variant="body">Last record {formatDateWithYear(lastDate)}</T> : null}
        <T variant="meta" style={styles.takeaway}>
          Receipt data not tracked in this preview.
        </T>
      </Card>

      <SectionHeader title="What is due next" />
      <Card style={styles.sectionCard}>
        {dueReminders.map((r, i) => (
          <View key={r.id} style={[styles.row, i > 0 && styles.rowBorder]}>
            <T variant="body" style={styles.rowText}>
              {r.description}
            </T>
          </View>
        ))}
        {dueReminders.length === 0 ? <T variant="meta">Nothing due.</T> : null}
      </Card>

      <SectionHeader title="Every record" />
      <Card style={styles.sectionCard}>
        {sortedByDate.map((r, i) => {
          const v = vehicleById.get(r.vehicleId);
          return (
            <View key={r.id} style={[styles.recordRow, i > 0 && styles.rowBorder]}>
              <View style={styles.rowText}>
                <T variant="bodyStrong">{recordLabel(r)}</T>
                <T variant="meta">
                  {formatDateWithYear(r.date)} · {r.enteredByMemberName}
                  {r.place ? ` · ${r.place}` : ''}
                  {v ? ` · ${formatPlate(v.plate)}` : ''}
                </T>
              </View>
              <T variant="bodyStrong">{formatMoney(r.amount, '')}</T>
            </View>
          );
        })}
        {sortedByDate.length === 0 ? <T variant="meta">No records in this period.</T> : null}
      </Card>

      <T variant="meta" center style={styles.footerText}>
        GENERATED {formatDateWithYear(today)} · FIGURES ARE ROUNDED TO THE SHILLING.
      </T>
      <T variant="meta" center style={styles.filename}>
        {filename}
      </T>
          </>
        )}
      </QueryBoundary>
    </Screen>
  );
}

const styles = StyleSheet.create({
  brandRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  letterRule: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: Spacing.md,
  },
  kv: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  totalLabel: {
    marginTop: Spacing.lg,
  },
  content: {
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xxxl,
  },
  letterhead: {
    marginTop: Spacing.md,
    marginBottom: Spacing.lg,
    gap: 8,
  },
  garageName: {
    marginTop: 2,
  },
  letterMeta: {
    marginTop: Spacing.xs,
  },
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  statCard: {
    flexBasis: '47%',
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    gap: 2,
  },
  sectionCard: {
    marginBottom: Spacing.lg,
    gap: 0,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  recordRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  rowBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  takeaway: {
    marginTop: Spacing.xs,
  },
  footerText: {
    marginTop: Spacing.md,
  },
  filename: {
    marginTop: 2,
    marginBottom: Spacing.md,
  },
  footerRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  footerBtn: {
    flex: 1,
  },
});
