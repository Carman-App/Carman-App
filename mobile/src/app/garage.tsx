import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { QueryBoundary } from '@/components/data/QueryBoundary';
import { MoneyFigure, Rule, SpendBar, TickBar } from '@/components/ui/Blocks';
import { Button, IconButton } from '@/components/ui/Button';
import { Segmented } from '@/components/ui/Chip';
import { EmptyState } from '@/components/ui/EmptyState';
import { IconGlyph } from '@/components/ui/IconGlyph';
import { Screen } from '@/components/ui/Screen';
import { T } from '@/components/ui/Typography';
import { TopBar } from '@/components/ui/TopBar';
import {
  useActiveGarage,
  useCurrency,
  useGarageMembers,
  useGarageRecords,
  useGarageReminders,
  useNotifications,
  usePendingAccessRequests,
  useVehicles,
} from '@/data/hooks';
import { formatNumber } from '@/lib/format';
import { periodRecords, periodTrend, spendSegments, sumAmount, type Period } from '@/lib/spend';
import { Colors, FontFamily, Spacing } from '@/theme/tokens';
import { USAGE_LABEL, type Reminder, type Vehicle, type VehicleRecord } from '@/types/domain';

/** My garage: the spend summary, then each vehicle with its odometer against the next service. */
export default function GarageScreen() {
  const garageQuery = useActiveGarage();
  const garage = garageQuery.data;
  const vehiclesQuery = useVehicles(garage?.id);
  const members = useGarageMembers(garage?.id).data ?? [];
  const records = useGarageRecords(garage?.id).data ?? [];
  const reminders = useGarageReminders(garage?.id).data ?? [];
  const pending = usePendingAccessRequests(garage?.id).data ?? [];
  const unread = (useNotifications().data ?? []).filter((n) => !n.readAt).length + pending.length;
  const currency = useCurrency();
  const [period, setPeriod] = useState<Exclude<Period, 'all'>>('year');

  const primary = useMemo(
    () => ({
      data: garage && vehiclesQuery.data ? { garage, vehicles: vehiclesQuery.data } : undefined,
      isLoading: garageQuery.isLoading || vehiclesQuery.isLoading,
      isError: garageQuery.isError || vehiclesQuery.isError,
      error: garageQuery.error ?? vehiclesQuery.error,
      refetch: () => {
        garageQuery.refetch();
        vehiclesQuery.refetch();
      },
    }),
    [garage, garageQuery, vehiclesQuery]
  );

  const rows = periodRecords(records, period);
  const total = sumAmount(rows);
  const trend = periodTrend(records, period);

  return (
    <Screen
      padded={false}
      header={
        <TopBar
          backLabel="HOME"
          fallback="/home"
          right={
            <View style={styles.headActions}>
              <IconButton glyph="settings" onPress={() => garage && router.push(`/garages/${garage.id}/settings`)} accessibilityLabel="Garage settings" />
              <Pressable accessibilityRole="button" onPress={() => router.push('/notifications')} style={styles.unread}>
                <T variant="eyebrow" color={Colors.body}>
                  {unread} UNREAD
                </T>
                {unread > 0 ? <View style={styles.redDot} /> : null}
              </Pressable>
            </View>
          }
        />
      }>
      <QueryBoundary query={primary} isEmpty={() => false}>
        {({ garage, vehicles }) => (
          <>
            <Pressable accessibilityRole="button" onPress={() => router.push('/garages')} style={styles.title}>
              <T variant="eyebrow" color={Colors.slate}>
                MY GARAGE
              </T>
              <View style={styles.nameRow}>
                <T variant="display">{garage.name}</T>
                <IconGlyph glyph="swap" size={28} bg="transparent" fg={Colors.accent} scale={0.7} />
              </View>
              <T variant="eyebrow" color={Colors.slate}>
                {vehicles.length} VEHICLE{vehicles.length === 1 ? '' : 'S'} · {members.length} MEMBER{members.length === 1 ? '' : 'S'}
                {garage.location && garage.location !== 'Not set' ? ` · ${garage.location.split(',').pop()?.trim().toUpperCase()}` : ''}
              </T>
            </Pressable>
            <Rule bleed={false} />

            {vehicles.length === 0 ? (
              <EmptyState glyph="garage-door" title="Your garage is empty." body="Add the vehicle you drive most. Every fill, service and receipt then builds its record.">
                <Button onPress={() => router.push('/vehicle/add')} style={styles.emptyCta}>
                  Add your first vehicle
                </Button>
              </EmptyState>
            ) : (
              <>
                <Pressable accessibilityRole="button" onPress={() => router.push('/insights')} style={styles.spend}>
                  <View style={styles.spendHead}>
                    <Segmented
                      value={period}
                      onChange={setPeriod}
                      options={[
                        { key: 'month', label: 'Month' },
                        { key: 'year', label: 'Year' },
                      ]}
                    />
                    {trend !== null ? (
                      <T variant="eyebrowStrong" color={Colors.accent}>
                        {trend >= 0 ? '↗' : '↘'} {Math.abs(trend).toFixed(1)}% on {period === 'year' ? new Date().getFullYear() - 1 : 'last month'}
                      </T>
                    ) : null}
                  </View>
                  <MoneyFigure currency={currency} amount={formatNumber(total)} />
                  <SpendBar segments={spendSegments(rows)} />
                </Pressable>
                <Rule bleed={false} />
                {vehicles.map((v) => (
                  <VehicleRow key={v.id} vehicle={v} records={records.filter((r) => r.vehicleId === v.id)} reminders={reminders.filter((r) => r.vehicleId === v.id)} />
                ))}
                <View style={styles.add}>
                  <Button variant="secondary" size="md" glyph="add" onPress={() => router.push('/vehicle/add')}>
                    Add a vehicle
                  </Button>
                </View>
              </>
            )}
          </>
        )}
      </QueryBoundary>
    </Screen>
  );
}

function VehicleRow({ vehicle, records, reminders }: { vehicle: Vehicle; records: VehicleRecord[]; reminders: Reminder[] }) {
  const due = vehicle.nextServiceDueKm ?? reminders.find((r) => r.kind === 'service-due' && r.dueKm)?.dueKm;
  const remaining = due ? due - vehicle.odometerKm : null;
  const interval = 10000;
  const progress = remaining !== null ? 1 - Math.max(0, Math.min(interval, remaining)) / interval : 0.5;
  const urgent = reminders.find((r) => r.kind !== 'service-due' && r.dueKm && r.dueKm - vehicle.odometerKm < 1000);
  const spent = sumAmount(records);
  const isProject = vehicle.usage === 'project';

  let right: { text: string; color: string };
  if (urgent?.dueKm) right = { text: `${urgent.description.split(' ').slice(0, 2).join(' ').toUpperCase()} IN ${formatNumber(urgent.dueKm - vehicle.odometerKm)} KM`, color: Colors.signal };
  else if (remaining !== null) right = remaining < 0 ? { text: `SERVICE OVERDUE ${formatNumber(-remaining)} KM`, color: Colors.signal } : { text: `SERVICE IN ${formatNumber(remaining)}`, color: Colors.slate };
  else right = { text: 'NO SERVICE SET', color: Colors.textFaint };

  return (
    <Pressable accessibilityRole="button" onPress={() => router.push(`/vehicle/${vehicle.id}`)} style={({ pressed }) => [styles.vehicle, pressed && { backgroundColor: '#F7F5F2' }]}>
      <View style={styles.vehicleHead}>
        <View style={styles.vehicleText}>
          <T style={styles.vehicleName}>{vehicle.model}</T>
          <T variant="eyebrow" color={Colors.slate}>
            {vehicle.make} · {vehicle.year} · {USAGE_LABEL[vehicle.usage]}
          </T>
        </View>
        <View style={styles.photo}>
          <IconGlyph glyph={vehicle.type === 'motorcycle' ? 'motorcycle' : 'vehicle'} size={30} bg="transparent" fg={Colors.textFaint} />
        </View>
      </View>
      <TickBar progress={progress} ticks={56} />
      <View style={styles.vehicleFoot}>
        <T variant="eyebrow" color={Colors.ink}>
          {isProject ? `${spentLabel(spent)}` : `${formatNumber(vehicle.odometerKm)} KM`}
        </T>
        <T variant="eyebrow" color={right.color}>
          {right.text}
        </T>
      </View>
    </Pressable>
  );
}

function spentLabel(n: number) {
  return `SPENT ${formatNumber(n)}`;
}

const styles = StyleSheet.create({
  headActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  unread: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  redDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.signal,
  },
  title: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.lg,
    gap: 6,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  emptyCta: {
    marginTop: Spacing.md,
    minWidth: 240,
  },
  spend: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
    gap: Spacing.md,
  },
  spendHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  vehicle: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
    gap: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  vehicleHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
  },
  vehicleText: {
    flex: 1,
    gap: 6,
  },
  vehicleName: {
    fontFamily: FontFamily.medium,
    fontSize: 17,
    letterSpacing: -0.2,
    color: Colors.ink,
  },
  photo: {
    width: 50,
    height: 34,
    borderRadius: 4,
    backgroundColor: Colors.surfaceSand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vehicleFoot: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  add: {
    padding: Spacing.lg,
  },
});
