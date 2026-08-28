import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { EmptyState } from '@/components/ui/EmptyState';
import { IconGlyph } from '@/components/ui/IconGlyph';
import { ListRow } from '@/components/ui/ListRow';
import { Screen } from '@/components/ui/Screen';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { T } from '@/components/ui/Typography';
import { QueryBoundary } from '@/components/data/QueryBoundary';
import { useActiveGarage, useGarageMembers, useGarageRecords, usePendingAccessRequests, useVehicles } from '@/data/hooks';
import { formatDateShort, formatMoney, formatNumber, formatPlate } from '@/lib/format';
import { USAGE_LABEL, type Vehicle } from '@/types/domain';
import { CategoryColors, Colors, Radius, Shadow, Spacing } from '@/theme/tokens';

const CATEGORY_LABEL: Record<string, string> = {
  fuel: 'Fuel',
  service: 'Service',
  insurance: 'Insurance',
  loan: 'Loan',
  other: 'Other',
};

export default function GarageScreen() {
  const garageQuery = useActiveGarage();
  const garage = garageQuery.data;
  const vehiclesQuery = useVehicles(garage?.id);
  const vehicles = vehiclesQuery.data ?? [];
  const membersQuery = useGarageMembers(garage?.id);
  const members = membersQuery.data ?? [];
  const recordsQuery = useGarageRecords(garage?.id);
  const records = useMemo(() => recordsQuery.data ?? [], [recordsQuery.data]);
  const pendingRequestsQuery = usePendingAccessRequests(garage?.id);
  const pendingRequests = pendingRequestsQuery.data ?? [];
  const [period, setPeriod] = useState<'month' | 'year'>('month');

  // The whole page is meaningless without the garage + its vehicles — those
  // two gate loading/error. Members/records/pending-requests are secondary
  // (counts and a preview list) and degrade to empty arrays while loading.
  const primaryQuery = useMemo(
    () => ({
      data: garage && vehiclesQuery.data ? ({ garage, vehicles: vehiclesQuery.data } as const) : undefined,
      isLoading: garageQuery.isLoading || vehiclesQuery.isLoading,
      isError: garageQuery.isError || vehiclesQuery.isError,
      error: garageQuery.error ?? vehiclesQuery.error,
      refetch: () => {
        garageQuery.refetch();
        vehiclesQuery.refetch();
      },
    }),
    [garage, vehiclesQuery, garageQuery]
  );

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
      const key = r.category ?? 'other';
      map.set(key, (map.get(key) ?? 0) + r.amount);
    }
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([key, amount]) => ({ key, amount, pct: total > 0 ? Math.round((amount / total) * 100) : 0 }));
  }, [periodRecords, total]);

  const timeline = records.slice(0, 6);
  const vehicleById = new Map(vehicles.map((v) => [v.id, v] as const));

  return (
    <Screen scroll contentStyle={styles.content}>
      <QueryBoundary query={primaryQuery} isEmpty={() => false}>
        {({ garage }) => (
          <>
            <View style={styles.headerRow}>
              <T variant="eyebrowStrong" color={Colors.text}>
                CARMA
              </T>
              <View style={styles.headerActions}>
                {pendingRequests.length > 0 ? (
                  <Pressable style={styles.badge} onPress={() => router.push('/notifications')}>
                    <T variant="meta" color={Colors.white} style={{ fontFamily: undefined }}>
                      {pendingRequests.length} UNREAD
                    </T>
                  </Pressable>
                ) : null}
                <Pressable onPress={() => router.push('/settings')}>
                  <IconGlyph glyph="member" size={32} />
                </Pressable>
              </View>
            </View>

            <Pressable onPress={() => router.push('/garages')} style={styles.garageHeader}>
              <T variant="display">{garage.name.toUpperCase()}</T>
              <T variant="body" color={Colors.textMuted}>
                {garage.location}
              </T>
              <T variant="eyebrow" style={styles.garageMeta}>
                {vehicles.length === 0
                  ? `NO VEHICLES YET · JUST YOU · ${garage.location.split(',').pop()?.trim().toUpperCase()}`
                  : `${vehicles.length} VEHICLE${vehicles.length === 1 ? '' : 'S'} · ${members.length} MEMBER${members.length === 1 ? '' : 'S'} · ${garage.location.split(',').pop()?.trim().toUpperCase()}`}
              </T>
            </Pressable>

            {vehicles.length === 0 ? (
              <EmptyState glyph="garage" title="Your garage is empty." body="Add the vehicle you drive most. From then on every fill, service and receipt builds its record, and you will know what it truly costs you.">
                <View style={styles.emptySteps}>
                  {['Add a vehicle · takes a minute', 'Log your next fill or service', 'Carma keeps the history for you'].map((step, i) => (
                    <View key={step} style={styles.emptyStepRow}>
                      <T variant="eyebrowStrong" color={Colors.accent}>
                        {String(i + 1).padStart(2, '0')}
                      </T>
                      <T variant="body">{step}</T>
                    </View>
                  ))}
                </View>
                <Button style={styles.emptyCta} onPress={() => router.push('/vehicle/add')}>
                  Add your first vehicle
                </Button>
              </EmptyState>
            ) : (
              <>
                <View style={styles.periodRow}>
                  <Chip label="Month" selected={period === 'month'} onPress={() => setPeriod('month')} />
                  <Chip label="Year" selected={period === 'year'} onPress={() => setPeriod('year')} />
                </View>

                <View style={styles.spendRow}>
                  <T variant="numericLarge">{formatMoney(total)}</T>
                  {change !== 0 ? (
                    <T variant="bodyStrong" color={change > 0 ? Colors.danger : Colors.positive}>
                      {change > 0 ? '↗' : '↘'} {Math.abs(change).toFixed(1)}%
                    </T>
                  ) : null}
                </View>

                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsRow} contentContainerStyle={{ gap: Spacing.xs }}>
                  {categoryTotals.map((c) => {
                    const colors = CategoryColors[c.key as keyof typeof CategoryColors] ?? CategoryColors.other;
                    return (
                      <Chip key={c.key} label={CATEGORY_LABEL[c.key] ?? c.key} value={`${c.pct}%`} fg={colors.fg} bg={colors.bg} />
                    );
                  })}
                </ScrollView>

                <SectionHeader title="Your vehicles" />
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.vehicleRow}>
                  {vehicles.map((v) => (
                    <VehicleCard key={v.id} vehicle={v} />
                  ))}
                  <Pressable style={styles.addVehicleCard} onPress={() => router.push('/vehicle/add')}>
                    <T variant="heading" color={Colors.accent}>
                      +
                    </T>
                    <T variant="meta" color={Colors.accent}>
                      Add vehicle
                    </T>
                  </Pressable>
                </ScrollView>

                <SectionHeader title={`Latest 6 of ${records.length}`} action="ALL →" onAction={() => router.push('/reports/all-expenses')} />
                <Card padded={false} style={styles.timelineCard}>
                  {timeline.map((r, i) => {
                    const v = vehicleById.get(r.vehicleId);
                    return (
                      <ListRow
                        key={r.id}
                        bordered={i < timeline.length - 1}
                        title={recordTitle(r.type, r.litres)}
                        subtitle={`${formatPlate(v?.plate)} · ${r.enteredByMemberName.toUpperCase()}`}
                        onPress={() => router.push(`/record/${r.id}/edit`)}
                        style={styles.timelineRow}
                        right={
                          <>
                            <T variant="meta">{formatDateShort(r.date)}</T>
                            <T variant="bodyStrong">{formatMoney(r.amount, '')}</T>
                          </>
                        }
                      />
                    );
                  })}
                </Card>
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

function VehicleCard({ vehicle }: { vehicle: Vehicle }) {
  const remainingKm = vehicle.nextServiceDueKm ? vehicle.nextServiceDueKm - vehicle.odometerKm : null;
  return (
    <Pressable onPress={() => router.push(`/vehicle/${vehicle.id}`)} style={styles.vehicleCard}>
      <IconGlyph glyph={vehicle.type === 'car' ? 'vehicle' : 'motorcycle'} size={40} />
      <T variant="eyebrow" style={styles.vehicleUsage}>
        {USAGE_LABEL[vehicle.usage]}
      </T>
      <T variant="subheading">
        {vehicle.make} {vehicle.model}
      </T>
      <T variant="meta">{vehicle.year}</T>
      <T variant="bodyStrong" style={styles.vehicleStat}>
        {formatNumber(vehicle.odometerKm)} KM
      </T>
      {remainingKm != null ? (
        <T variant="meta" color={Colors.accent}>
          Service in {formatNumber(remainingKm)}
        </T>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: Spacing.sm,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  badge: {
    backgroundColor: Colors.accent,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
  },
  garageHeader: {
    marginBottom: Spacing.md,
  },
  garageMeta: {
    marginTop: Spacing.xs,
  },
  emptyCta: {
    marginTop: Spacing.md,
    minWidth: 220,
  },
  emptySteps: {
    gap: Spacing.xs,
    marginTop: Spacing.sm,
    alignSelf: 'stretch',
  },
  emptyStepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  periodRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
  },
  spendRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.sm,
  },
  chipsRow: {
    marginTop: Spacing.md,
    marginBottom: Spacing.lg,
  },
  vehicleRow: {
    gap: Spacing.sm,
    paddingBottom: Spacing.md,
  },
  vehicleCard: {
    width: 168,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    gap: 2,
    ...Shadow.card,
  },
  vehicleUsage: {
    marginTop: Spacing.xs,
  },
  vehicleStat: {
    marginTop: Spacing.xs,
  },
  addVehicleCard: {
    width: 100,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  timelineCard: {
    padding: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  timelineRow: {
    paddingHorizontal: Spacing.sm,
  },
});
