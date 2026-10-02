import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { IconGlyph } from '@/components/ui/IconGlyph';
import { ListRow } from '@/components/ui/ListRow';
import { Screen } from '@/components/ui/Screen';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { T } from '@/components/ui/Typography';
import { QueryBoundary } from '@/components/data/QueryBoundary';
import { useEstimates, useInvoices, useProject, useRecords, useVehicle } from '@/data/hooks';
import { formatDateShort, formatDistance, formatMoney, formatPlate, formatVolume, getActiveCurrency, getActiveDistanceUnit, KM_TO_MI } from '@/lib/format';
import { USAGE_LABEL } from '@/types/domain';
import { CategoryColors, Colors, Radius, Shadow, Spacing } from '@/theme/tokens';

const CATEGORY_LABEL: Record<string, string> = {
  fuel: 'Fuel',
  service: 'Service',
  repair: 'Repairs',
  insurance: 'Insurance',
  loan: 'Loan',
  other: 'Other',
};

export default function VehicleHubScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const vehicleQuery = useVehicle(id);
  const vehicle = vehicleQuery.data;
  const recordsQuery = useRecords(id);
  const records = useMemo(() => recordsQuery.data ?? [], [recordsQuery.data]);
  const project = useProject(id).data;
  const estimates = useEstimates(id).data ?? [];
  const invoices = useInvoices(id).data ?? [];
  const [period, setPeriod] = useState<'month' | 'year'>('month');

  const now = useMemo(() => new Date(), []);
  const periodRecords = useMemo(
    () =>
      records.filter((r) => {
        const d = new Date(r.date + 'T00:00:00');
        if (period === 'year') return d.getFullYear() === now.getFullYear();
        return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
      }),
    [records, period, now]
  );
  const total = periodRecords.reduce((sum, r) => sum + r.amount, 0);
  const prevTotal = useMemo(() => {
    const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return records
      .filter((r) => {
        const d = new Date(r.date + 'T00:00:00');
        return d.getFullYear() === prevMonth.getFullYear() && d.getMonth() === prevMonth.getMonth();
      })
      .reduce((sum, r) => sum + r.amount, 0);
  }, [records, now]);
  const change = prevTotal > 0 ? ((total - prevTotal) / prevTotal) * 100 : 0;

  const categoryTotals = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of periodRecords) {
      const key = r.category ?? (r.type === 'repair' ? 'repair' : 'other');
      map.set(key, (map.get(key) ?? 0) + r.amount);
    }
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([key, amount]) => ({ key, amount, pct: total > 0 ? Math.round((amount / total) * 100) : 0 }));
  }, [periodRecords, total]);

  const lifetimeSpend = useMemo(() => records.reduce((sum, r) => sum + r.amount, 0), [records]);
  const perKm = vehicle && vehicle.odometerKm > 0 ? lifetimeSpend / vehicle.odometerKm : 0;
  // Rate (currency per km), not a plain distance — see Insights' matching card doc.
  const distanceUnit = getActiveDistanceUnit();
  const perDistance = distanceUnit === 'mi' ? perKm / KM_TO_MI : perKm;

  const lastOdometerRecord = records.find((r) => r.odometerAtEntry != null);
  const remainingKm = vehicle?.nextServiceDueKm ? vehicle.nextServiceDueKm - vehicle.odometerKm : null;
  const pendingEstimate = estimates.find((e) => e.status === 'pending');
  const unpaidInvoice = invoices.find((i) => i.status === 'unpaid');
  const timeline = records.slice(0, 3);

  return (
    <Screen scroll contentStyle={styles.content}>
      <QueryBoundary query={vehicleQuery} isEmpty={() => false}>
        {(vehicle) => {
          const showProject = vehicle.usage === 'project' || !!project;
          return (
            <>
      <View style={styles.headerRow}>
        <Pressable onPress={() => router.back()}>
          <T variant="eyebrowStrong" color={Colors.accent}>
            ← GARAGE
          </T>
        </Pressable>
        <Pressable onPress={() => router.push(`/vehicle/${id}/details`)}>
          <T variant="eyebrowStrong" color={Colors.textMuted}>
            MORE
          </T>
        </Pressable>
      </View>

      <T variant="eyebrow">{USAGE_LABEL[vehicle.usage]}</T>
      <T variant="display" style={styles.title}>
        {vehicle.make} {vehicle.model}
      </T>
      <T variant="body" color={Colors.textMuted}>
        {vehicle.year} · {vehicle.powertrain ? vehicle.powertrain.toUpperCase() : 'ENGINE NOT SET'} · {formatPlate(vehicle.plate)}
      </T>

      <View style={styles.photo}>
        <IconGlyph glyph={vehicle.type === 'car' ? 'vehicle' : 'motorcycle'} size={64} />
        <T variant="meta" style={styles.addPhoto}>
          ADD PHOTO
        </T>
      </View>

      {pendingEstimate ? (
        <Card style={styles.estimateBanner} onPress={() => router.push(`/estimates/${pendingEstimate.id}`)}>
          <T variant="eyebrowStrong" color={Colors.accent}>
            ESTIMATE AWAITING YOUR APPROVAL
          </T>
          <T variant="bodyStrong" style={styles.estimateRow}>
            {pendingEstimate.workshopName}
          </T>
          <View style={styles.estimateFooter}>
            <T variant="numeric">{formatMoney(pendingEstimate.total)}</T>
            <Pressable style={styles.confirmBtn} onPress={() => router.push(`/estimates/${pendingEstimate.id}`)}>
              <T variant="bodyStrong" color={Colors.white}>
                CONFIRM
              </T>
            </Pressable>
          </View>
        </Card>
      ) : null}

      <View style={styles.periodRow}>
        <SectionHeader title="Spent this" right={
          <View style={styles.periodToggle}>
            <Chip label="Month" selected={period === 'month'} onPress={() => setPeriod('month')} />
            <Chip label="Year" selected={period === 'year'} onPress={() => setPeriod('year')} />
          </View>
        } />
      </View>
      <View style={styles.spendRow}>
        <T variant="numericLarge">{formatMoney(total)}</T>
        {change !== 0 ? (
          <T variant="bodyStrong" color={change > 0 ? Colors.danger : Colors.accent}>
            {change > 0 ? '↗' : '↘'} {Math.abs(change).toFixed(1)}%
          </T>
        ) : null}
      </View>

      <View style={styles.chipsRow}>
        {categoryTotals.map((c) => {
          const colors = CategoryColors[c.key as keyof typeof CategoryColors] ?? CategoryColors.other;
          return <Chip key={c.key} label={CATEGORY_LABEL[c.key] ?? c.key} value={`${c.pct}%`} fg={colors.fg} bg={colors.bg} style={styles.chip} />;
        })}
      </View>

      <View style={styles.statGrid}>
        <Card style={styles.statCard}>
          <T variant="eyebrow">ODOMETER</T>
          <T variant="numeric">{formatDistance(vehicle.odometerKm, { withUnit: false })}</T>
          <T variant="meta">{getActiveDistanceUnit().toUpperCase()} · READ {lastOdometerRecord ? formatDateShort(lastOdometerRecord.date) : '—'}</T>
        </Card>
        <Card style={styles.statCard}>
          <T variant="eyebrow">NEXT SERVICE</T>
          <T variant="numeric">
            {vehicle.nextServiceDueKm
              ? `${formatDistance(vehicle.nextServiceDueKm, { withUnit: false })} ${getActiveDistanceUnit()}`
              : 'NOT SET'}
          </T>
          <T variant="meta">{remainingKm != null ? `${formatDistance(remainingKm)} AWAY` : ''}</T>
        </Card>
      </View>

      <View style={styles.statGrid}>
        <Card style={styles.statCard}>
          <T variant="eyebrow">PER {distanceUnit.toUpperCase()}</T>
          <T variant="numeric">{perDistance.toFixed(2)}</T>
          <T variant="meta">{getActiveCurrency()}</T>
        </Card>
        {unpaidInvoice ? (
          <Card style={styles.statCard} onPress={() => router.push(`/invoices/${unpaidInvoice.id}`)}>
            <T variant="eyebrow" color={Colors.danger}>
              OUTSTANDING
            </T>
            <T variant="numeric" color={Colors.danger}>
              {formatMoney(unpaidInvoice.total)}
            </T>
            <T variant="meta">1 INVOICE</T>
          </Card>
        ) : (
          <View style={styles.statCard} />
        )}
      </View>

      <View style={styles.linksRow}>
        <Pressable style={styles.linkChip} onPress={() => router.push(`/vehicle/${id}/details`)}>
          <T variant="eyebrowStrong" color={Colors.textMuted}>
            DETAILS
          </T>
        </Pressable>
        <Pressable style={styles.linkChip} onPress={() => router.push(`/vehicle/${id}/documents`)}>
          <T variant="eyebrowStrong" color={Colors.textMuted}>
            DOCUMENTS
          </T>
        </Pressable>
        {showProject ? (
          <Pressable style={styles.linkChip} onPress={() => router.push(`/vehicle/${id}/project`)}>
            <T variant="eyebrowStrong" color={Colors.textMuted}>
              PROJECT
            </T>
          </Pressable>
        ) : null}
        <Pressable style={styles.linkChip} onPress={() => router.push(`/vehicle/${id}/qr`)}>
          <T variant="eyebrowStrong" color={Colors.textMuted}>
            SHARE / QR
          </T>
        </Pressable>
      </View>

      <SectionHeader title="Timeline" action={`ALL ${records.length} →`} onAction={() => router.push(`/vehicle/${id}/timeline`)} />
      <Card padded={false} style={styles.timelineCard}>
        {timeline.length === 0 ? (
          <T variant="meta" style={styles.emptyTimeline}>
            No records yet.
          </T>
        ) : (
          timeline.map((r, i) => (
            <ListRow
              key={r.id}
              bordered={i < timeline.length - 1}
              title={recordTitle(r.type, r.litres)}
              subtitle={formatDistance(r.odometerAtEntry)}
              onPress={() => router.push(`/record/${r.id}/edit`)}
              style={styles.timelineRow}
              right={
                <>
                  <T variant="meta">{formatDateShort(r.date)}</T>
                  <T variant="bodyStrong">{formatMoney(r.amount, '')}</T>
                </>
              }
            />
          ))
        )}
        {records.length > 3 ? (
          <Pressable onPress={() => router.push(`/vehicle/${id}/timeline`)} style={styles.scrollMore}>
            <T variant="eyebrow" center>
              SCROLL FOR MORE ↓
            </T>
          </Pressable>
        ) : null}
      </Card>

      <View style={styles.quickAddRow}>
        <Pressable style={styles.quickAddBtn} onPress={() => router.push({ pathname: '/record/fuel', params: { vehicleId: id } })}>
          <IconGlyph glyph="fuel" size={36} />
          <T variant="meta">FUEL</T>
        </Pressable>
        <Pressable style={styles.quickAddBtn} onPress={() => router.push({ pathname: '/record/service', params: { vehicleId: id } })}>
          <IconGlyph glyph="service" size={36} />
          <T variant="meta">SERVICE</T>
        </Pressable>
        <Pressable style={styles.quickAddBtn} onPress={() => router.push({ pathname: '/record/expense', params: { vehicleId: id } })}>
          <IconGlyph glyph="expense" size={36} />
          <T variant="meta">EXPENSE</T>
        </Pressable>
      </View>
            </>
          );
        }}
      </QueryBoundary>
    </Screen>
  );
}

function recordTitle(type: string, litres?: number) {
  if (type === 'fuel') return litres ? `Fuel · ${formatVolume(litres)}` : 'Fuel';
  if (type === 'service') return 'Service';
  if (type === 'repair') return 'Repair';
  if (type === 'part') return 'Part';
  if (type === 'odometer') return 'Odometer reading';
  return 'Expense';
}

const styles = StyleSheet.create({
  content: {
    paddingTop: Spacing.sm,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  title: {
    marginTop: Spacing.xxs,
  },
  photo: {
    alignItems: 'center',
    gap: Spacing.xs,
    marginVertical: Spacing.lg,
  },
  addPhoto: {
    letterSpacing: 1,
  },
  estimateBanner: {
    marginBottom: Spacing.lg,
    gap: 4,
  },
  estimateRow: {
    marginTop: 2,
  },
  estimateFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.xs,
  },
  confirmBtn: {
    backgroundColor: Colors.accent,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
  },
  periodRow: {
    marginTop: Spacing.sm,
  },
  periodToggle: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  spendRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.sm,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginTop: Spacing.md,
    marginBottom: Spacing.lg,
  },
  chip: {},
  statGrid: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  statCard: {
    flex: 1,
    gap: 2,
  },
  linksRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginTop: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  linkChip: {
    backgroundColor: Colors.surfaceMuted,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 8,
  },
  timelineCard: {
    padding: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  timelineRow: {
    paddingHorizontal: Spacing.sm,
  },
  emptyTimeline: {
    padding: Spacing.md,
  },
  scrollMore: {
    paddingVertical: Spacing.xs,
  },
  quickAddRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.md,
    ...Shadow.card,
  },
  quickAddBtn: {
    alignItems: 'center',
    gap: 4,
  },
});
