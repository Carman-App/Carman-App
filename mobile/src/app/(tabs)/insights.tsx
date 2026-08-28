import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Screen } from '@/components/ui/Screen';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { T } from '@/components/ui/Typography';
import { QueryBoundary } from '@/components/data/QueryBoundary';
import { useActiveGarage, useGarageRecords, useInsights, useVehicles } from '@/data/hooks';
import { formatMoney, formatPlate } from '@/lib/format';
import type { VehicleRecord } from '@/types/domain';
import { CategoryColors, Colors, Radius, Spacing } from '@/theme/tokens';

type Period = 'month' | 'lastMonth' | 'ytd' | 'custom';
const PERIOD_LABEL: Record<Period, string> = { month: 'Month', lastMonth: 'Last month', ytd: 'YTD', custom: 'Custom' };

const CATEGORY_GROUPS: { key: string; label: string; match: (r: VehicleRecord) => boolean }[] = [
  { key: 'fuel', label: 'Fuel and charging', match: (r) => r.category === 'fuel' },
  { key: 'service', label: 'Service', match: (r) => r.category === 'service' },
  { key: 'repair', label: 'Repairs and parts', match: (r) => r.type === 'repair' || r.type === 'part' },
  { key: 'insurance', label: 'Insurance and licences', match: (r) => r.category === 'insurance' },
  { key: 'other', label: 'Everything else', match: (r) => !['fuel', 'service', 'insurance'].includes(r.category ?? '') && r.type !== 'repair' && r.type !== 'part' },
];

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function InsightsScreen() {
  const garageQuery = useActiveGarage();
  const garage = garageQuery.data;
  const vehiclesQuery = useVehicles(garage?.id);
  const vehicles = vehiclesQuery.data ?? [];
  const allRecordsQuery = useGarageRecords(garage?.id);
  const allRecords = allRecordsQuery.data ?? [];
  const [scope, setScope] = useState<'garage' | string>('garage');
  const [period, setPeriod] = useState<Period>('ytd');

  // The real API has no per-record-shape aggregate endpoint at garage scope
  // (only a per-vehicle GET vehicles/:id/insights) — so garage-wide and
  // period-filtered totals below are still derived client-side from
  // useGarageRecords, same as the old mock version. The dedicated endpoint
  // IS used below (via useInsights) for the single-vehicle "cost per
  // kilometre" figure, which the mock used to compute (badly — period spend
  // divided by lifetime odometer) from records by hand.
  const insightsQuery = useInsights(scope !== 'garage' ? scope : undefined);

  const now = useMemo(() => new Date(), []);
  const scoped = scope === 'garage' ? allRecords : allRecords.filter((r) => r.vehicleId === scope);

  const periodRecords = useMemo(() => {
    return scoped.filter((r) => {
      const d = new Date(r.date + 'T00:00:00');
      if (period === 'month') return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
      if (period === 'lastMonth') {
        const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        return d.getFullYear() === prev.getFullYear() && d.getMonth() === prev.getMonth();
      }
      return d.getFullYear() === now.getFullYear();
    });
  }, [scoped, period, now]);

  const total = periodRecords.reduce((s, r) => s + r.amount, 0);
  const monthsWithActivity = new Set(periodRecords.map((r) => r.date.slice(0, 7))).size || 1;
  const perMonth = total / monthsWithActivity;

  const monthly = useMemo(() => {
    const map = new Map<number, number>();
    for (const r of periodRecords) {
      const d = new Date(r.date + 'T00:00:00');
      map.set(d.getMonth(), (map.get(d.getMonth()) ?? 0) + r.amount);
    }
    return map;
  }, [periodRecords]);
  const maxMonth = Math.max(1, ...Array.from(monthly.values()));
  const heaviestMonthIdx = Array.from(monthly.entries()).sort((a, b) => b[1] - a[1])[0]?.[0];

  const categoryBreakdown = CATEGORY_GROUPS.map((g) => {
    const recs = periodRecords.filter(g.match);
    const amount = recs.reduce((s, r) => s + r.amount, 0);
    return { ...g, count: recs.length, amount, pct: total > 0 ? Math.round((amount / total) * 100) : 0 };
  }).filter((g) => g.count > 0);

  const vehicleBreakdown = vehicles
    .map((v) => {
      const recs = scoped.filter((r) => r.vehicleId === v.id && periodRecords.includes(r));
      const amount = recs.reduce((s, r) => s + r.amount, 0);
      return { vehicle: v, count: recs.length, amount, pct: total > 0 ? Math.round((amount / total) * 100) : 0 };
    })
    .filter((v) => v.count > 0)
    .sort((a, b) => b.amount - a.amount);

  const singleVehicle = scope !== 'garage' ? vehicles.find((v) => v.id === scope) : undefined;

  return (
    <Screen scroll contentStyle={styles.content}>
      <T variant="eyebrowStrong">INSIGHTS</T>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scopeRow} contentContainerStyle={{ gap: Spacing.xs }}>
        <Chip label="Whole garage" selected={scope === 'garage'} onPress={() => setScope('garage')} />
        {vehicles.map((v) => (
          <Chip key={v.id} label={v.model} selected={scope === v.id} onPress={() => setScope(v.id)} />
        ))}
      </ScrollView>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.periodRow} contentContainerStyle={{ gap: Spacing.xs }}>
        {(Object.keys(PERIOD_LABEL) as Period[]).map((p) => (
          <Chip key={p} label={PERIOD_LABEL[p]} selected={period === p} onPress={() => setPeriod(p)} />
        ))}
      </ScrollView>

      <QueryBoundary query={allRecordsQuery} isEmpty={() => false}>
        {() => (
          <>
            <View style={styles.totalBlock}>
              <T variant="numericLarge">{formatMoney(total)}</T>
              <T variant="meta">{periodRecords.length} RECORDS</T>
              <T variant="meta">PER MONTH AVG · {formatMoney(perMonth)}</T>
            </View>

            <SectionHeader title="Month by month" />
            <Card style={styles.monthCard}>
              {MONTHS.slice(0, now.getMonth() + 1).map((m, i) => {
                const val = monthly.get(i) ?? 0;
                const isHeaviest = i === heaviestMonthIdx && val > 0;
                return (
                  <View key={m} style={styles.monthRow}>
                    <T variant="meta" style={styles.monthLabel}>
                      {m.toUpperCase()}
                    </T>
                    <View style={styles.barTrack}>
                      <View style={[styles.barFill, { width: `${Math.max(4, (val / maxMonth) * 100)}%` }, isHeaviest && styles.barFillHeavy]} />
                    </View>
                    <T variant="meta" style={styles.monthValue}>
                      {formatMoney(val, '')}
                    </T>
                  </View>
                );
              })}
              {heaviestMonthIdx != null ? (
                <T variant="meta" color={Colors.accent} style={styles.heaviestNote}>
                  HEAVIEST MONTH · {MONTHS[heaviestMonthIdx].toUpperCase()}
                </T>
              ) : null}
            </Card>

            <SectionHeader title="By category" />
            <Card style={styles.breakdownCard}>
              {categoryBreakdown.map((c, i) => {
                const colors = CategoryColors[c.key as keyof typeof CategoryColors] ?? CategoryColors.other;
                return (
                  <View key={c.key} style={[styles.breakdownRow, i > 0 && styles.breakdownRowBorder]}>
                    <View style={[styles.dot, { backgroundColor: colors.fg }]} />
                    <View style={styles.breakdownText}>
                      <T variant="bodyStrong">{c.label}</T>
                      <T variant="meta">
                        {c.count} record{c.count === 1 ? '' : 's'} · {c.pct}%
                      </T>
                    </View>
                    <T variant="bodyStrong">{formatMoney(c.amount, '')}</T>
                  </View>
                );
              })}
              {categoryBreakdown.length === 0 ? <T variant="meta">No records in this period.</T> : null}
            </Card>

            {scope === 'garage' ? (
              <>
                <SectionHeader title="By vehicle" />
                <Card style={styles.breakdownCard}>
                  {vehicleBreakdown.map((v, i) => (
                    <View key={v.vehicle.id} style={[styles.breakdownRow, i > 0 && styles.breakdownRowBorder]}>
                      <View style={styles.breakdownText}>
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
                  {vehicleBreakdown.length === 0 ? <T variant="meta">No records in this period.</T> : null}
                </Card>
              </>
            ) : null}
          </>
        )}
      </QueryBoundary>

      <SectionHeader title="What a kilometre costs" />
      <Card style={styles.kmCard}>
        {singleVehicle ? (
          <QueryBoundary query={insightsQuery} isEmpty={() => false} compact>
            {(insights) => (
              <>
                <T variant="numericLarge">{insights.costPerKm != null ? insights.costPerKm.toFixed(2) : '—'}</T>
                <T variant="meta">
                  KES PER KM · LIFETIME · {singleVehicle.make} {singleVehicle.model}
                </T>
                {insights.costPerKm == null ? (
                  <T variant="meta" color={Colors.textMuted}>
                    Not enough odometer history yet to work this out.
                  </T>
                ) : null}
              </>
            )}
          </QueryBoundary>
        ) : (
          <T variant="body" color={Colors.textMuted}>
            Pick a single vehicle above to see its cost per kilometre.
          </T>
        )}
      </Card>

      <SectionHeader title="Export" action="BUILD A REPORT →" onAction={() => router.push('/reports/expense')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: Spacing.sm,
    gap: 0,
  },
  scopeRow: {
    marginTop: Spacing.md,
  },
  periodRow: {
    marginTop: Spacing.sm,
    marginBottom: Spacing.md,
  },
  totalBlock: {
    gap: 2,
    marginBottom: Spacing.lg,
  },
  monthCard: {
    marginBottom: Spacing.lg,
    gap: Spacing.xs,
  },
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  monthLabel: {
    width: 32,
  },
  barTrack: {
    flex: 1,
    height: 8,
    borderRadius: Radius.pill,
    backgroundColor: Colors.surfaceMuted,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: Radius.pill,
    backgroundColor: Colors.accent,
    opacity: 0.55,
  },
  barFillHeavy: {
    opacity: 1,
  },
  monthValue: {
    width: 70,
    textAlign: 'right',
  },
  heaviestNote: {
    marginTop: Spacing.xs,
  },
  breakdownCard: {
    marginBottom: Spacing.lg,
    gap: 0,
  },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  breakdownRowBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  breakdownText: {
    flex: 1,
    gap: 2,
  },
  kmCard: {
    marginBottom: Spacing.xl,
    gap: 4,
  },
});
