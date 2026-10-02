import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { QueryBoundary } from '@/components/data/QueryBoundary';
import { Dot, MoneyFigure, Rule, SpendBar, TickBar } from '@/components/ui/Blocks';
import { Button } from '@/components/ui/Button';
import { Segmented } from '@/components/ui/Chip';
import { IconGlyph } from '@/components/ui/IconGlyph';
import { Screen } from '@/components/ui/Screen';
import { T } from '@/components/ui/Typography';
import { TopBar } from '@/components/ui/TopBar';
import { useCurrency, useEstimates, useInvoices, useProject, useRecords, useReminders, useVehicle } from '@/data/hooks';
import { formatDateShort, formatNumber, formatPlate } from '@/lib/format';
import { dailyAverageKm, periodRecords, periodTrend, spendSegments, sumAmount, type Period } from '@/lib/spend';
import { Colors, FontFamily, Radius, Spacing } from '@/theme/tokens';
import { recordTitle, sortRecords } from '@/lib/records';
import { USAGE_LABEL } from '@/types/domain';

/** Vehicle: odometer, documents, reminders and the timeline for one car. */
export default function VehicleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const vehicleQuery = useVehicle(id);
  const recordsData = useRecords(id).data;
  const records = useMemo(() => sortRecords(recordsData), [recordsData]);
  const reminders = useReminders(id).data ?? [];
  const project = useProject(id).data;
  const estimates = useEstimates(id).data ?? [];
  const invoices = useInvoices(id).data ?? [];
  const currency = useCurrency();
  const [period, setPeriod] = useState<Exclude<Period, 'all'>>('year');
  const [now] = useState(() => Date.now());

  const pending = estimates.find((e) => e.status === 'pending');
  const unpaid = invoices.find((i) => i.status === 'unpaid');

  return (
    <Screen
      padded={false}
      header={<TopBar backLabel="HOME" fallback="/home" right={<View style={styles.more}><T variant="eyebrow" color={Colors.body}>MORE</T><Dot size={6} /></View>} onRight={() => router.push(`/vehicle/${id}/details`)} />}
      footer={
        <View style={styles.quick}>
          {[
            { label: 'Fuel', key: 'fuel' },
            { label: 'Service', key: 'service' },
            { label: 'Expense', key: 'add' },
          ].map((q) => (
            <Button
              key={q.key}
              caps
              size="md"
              style={styles.quickBtn}
              onPress={() =>
                q.key === 'add'
                  ? router.push({ pathname: '/record/add', params: { vehicleId: id } })
                  : router.push({ pathname: '/record/expense', params: { vehicleId: id, categoryKey: q.key } })
              }>
              {q.label}
            </Button>
          ))}
        </View>
      }>
      <QueryBoundary query={vehicleQuery} isEmpty={() => false}>
        {(vehicle) => {
          const rows = periodRecords(records, period);
          const trend = periodTrend(records, period);
          const daily = dailyAverageKm(records);
          const lastRead = records.find((r) => r.odometerAtEntry > 0);
          const daysSince = lastRead ? Math.max(0, Math.round((now - new Date(lastRead.date + 'T00:00:00').getTime()) / 86_400_000)) : 0;
          const estimateToday = daily && daysSince > 0 ? Math.round(vehicle.odometerKm + daily * daysSince) : null;
          const due = vehicle.nextServiceDueKm ?? reminders.find((r) => r.kind === 'service-due' && r.dueKm)?.dueKm;
          const readings = records.filter((r) => r.odometerAtEntry > 0).slice(0, 4);
          const showProject = vehicle.usage === 'project' || !!project;
          const links = [
            { label: 'Details', glyph: 'info', href: `/vehicle/${id}/details` },
            { label: 'Documents', glyph: 'document', href: `/vehicle/${id}/documents` },
            ...(showProject ? [{ label: 'Project', glyph: 'build', href: `/vehicle/${id}/project` }] : []),
            { label: 'Share access', glyph: 'qr', href: `/vehicle/${id}/qr` },
            { label: 'Report', glyph: 'share', href: `/reports/expense?vehicleId=${id}` },
          ];
          return (
            <>
              <View style={styles.head}>
                <View style={styles.flex}>
                  <T variant="eyebrow" color={Colors.accent}>
                    {USAGE_LABEL[vehicle.usage]}
                  </T>
                  <T variant="display">
                    {vehicle.make} {vehicle.model}
                  </T>
                  <T variant="eyebrow" color={Colors.slate}>
                    {[vehicle.year, vehicle.variant, vehicle.powertrain?.toUpperCase(), formatPlate(vehicle.plate)].filter(Boolean).join(' · ')}
                  </T>
                </View>
                <View style={styles.photo}>
                  <T variant="eyebrow" color={Colors.slate} center>
                    ADD PHOTO
                  </T>
                </View>
              </View>

              {pending ? (
                <Pressable onPress={() => router.push(`/estimates/${pending.id}`)} style={styles.estimate}>
                  <T variant="bodyStrong">Estimate awaiting your approval</T>
                  <T variant="eyebrow" color={Colors.signal}>
                    {pending.workshopName} · {currency} {formatNumber(pending.total)}
                  </T>
                </Pressable>
              ) : unpaid ? (
                <Pressable onPress={() => router.push(`/invoices/${unpaid.id}`)} style={styles.estimate}>
                  <T variant="bodyStrong">Invoice outstanding</T>
                  <T variant="eyebrow" color={Colors.signal}>
                    {unpaid.workshopName} · {currency} {formatNumber(unpaid.total)}
                  </T>
                </Pressable>
              ) : null}

              {estimateToday ? (
                <View style={styles.estimateOdo}>
                  <View style={styles.flex}>
                    <T style={styles.approx}>
                      ≈ {formatNumber(estimateToday)} <T variant="eyebrow">TODAY</T>
                    </T>
                    <T variant="eyebrow" color={Colors.slate}>
                      ESTIMATED FROM YOUR OWN AVERAGE OF {formatNumber(daily ?? 0)} KM A DAY
                    </T>
                  </View>
                  <Pressable onPress={() => router.push({ pathname: '/record/odometer-roll', params: { vehicleId: id } })} hitSlop={8}>
                    <T variant="eyebrowStrong" color={Colors.accent}>
                      CONFIRM
                    </T>
                  </Pressable>
                </View>
              ) : null}
              <Rule bleed={false} />

              <Pressable style={styles.block} onPress={() => router.push('/insights')}>
                <View style={styles.between}>
                  <View style={styles.row8}>
                    <T variant="eyebrow" color={Colors.slate}>
                      SPENT THIS:
                    </T>
                    <Segmented
                      value={period}
                      onChange={setPeriod}
                      options={[
                        { key: 'month', label: 'Month' },
                        { key: 'year', label: 'Year' },
                      ]}
                    />
                  </View>
                  {trend !== null ? (
                    <T variant="eyebrowStrong" color={Colors.accent}>
                      {trend >= 0 ? '↗' : '↘'} {Math.abs(trend).toFixed(1)}%
                    </T>
                  ) : null}
                </View>
                <MoneyFigure currency={currency} amount={formatNumber(sumAmount(rows))} />
                <SpendBar segments={spendSegments(rows)} />
              </Pressable>
              <Rule bleed={false} />

              <View style={[styles.block, styles.odo]}>
                <Pressable style={styles.flex} onPress={() => router.push({ pathname: '/record/odometer-roll', params: { vehicleId: id } })}>
                  <T variant="eyebrow" color={Colors.slate}>
                    ODOMETER
                  </T>
                  <T variant="numericLarge" style={styles.odoValue}>
                    {formatNumber(vehicle.odometerKm)}
                  </T>
                  <T variant="eyebrow" color={Colors.slate}>
                    KM{lastRead ? ` · READ ${formatDateShort(lastRead.date)}` : ''}
                  </T>
                  {due ? (
                    <View style={styles.service}>
                      <TickBar progress={1 - Math.max(0, Math.min(10000, due - vehicle.odometerKm)) / 10000} ticks={40} height={12} />
                      <T variant="eyebrow" color={due - vehicle.odometerKm < 0 ? Colors.signal : Colors.slate}>
                        NEXT SERVICE AT {formatNumber(due)} · {due - vehicle.odometerKm < 0 ? `${formatNumber(vehicle.odometerKm - due)} KM OVER` : `${formatNumber(due - vehicle.odometerKm)} KM AWAY`}
                      </T>
                    </View>
                  ) : null}
                </Pressable>
                <View style={styles.readings}>
                  {readings.map((r, i) => (
                    <View key={r.id} style={styles.reading}>
                      <View style={[styles.readingTick, i === 0 && { backgroundColor: Colors.accent, width: 16 }]} />
                      <View>
                        <T variant="small" color={i === 0 ? Colors.accent : Colors.body}>
                          {formatNumber(r.odometerAtEntry)}
                        </T>
                        <T variant="small" style={styles.readingSub} numberOfLines={1}>
                          {recordTitle(r).split(' · ')[0]}
                        </T>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
              <Rule bleed={false} />

              <View style={styles.links}>
                {links.map((l) => (
                  <Pressable key={l.label} onPress={() => router.push(l.href as never)} style={({ pressed }) => [styles.link, pressed && { backgroundColor: Colors.accentSoft }]}>
                    <IconGlyph glyph={l.glyph} size={22} bg="transparent" scale={0.85} />
                    <T variant="bodyStrong" style={{ fontSize: 13 }}>
                      {l.label}
                    </T>
                  </Pressable>
                ))}
              </View>
              <Rule bleed={false} />

              <View style={styles.block}>
                <View style={styles.between}>
                  <T variant="tag">TIMELINE</T>
                  <Pressable onPress={() => router.push(`/vehicle/${id}/timeline`)} hitSlop={8}>
                    <T variant="eyebrow" color={Colors.accent}>
                      ALL {records.length} →
                    </T>
                  </Pressable>
                </View>
                {records.length === 0 ? <T variant="meta">No records yet. Use the buttons below to log the first one.</T> : null}
                {records.slice(0, 4).map((r) => (
                  <Pressable key={r.id} onPress={() => router.push(`/record/${r.id}/edit`)} style={styles.tl}>
                    <T variant="eyebrow" style={styles.tlDate}>
                      {formatDateShort(r.date)}
                    </T>
                    <View style={styles.flex}>
                      <T variant="bodyStrong">{recordTitle(r)}</T>
                      <T variant="eyebrow" color={Colors.slate}>
                        {[r.place, r.odometerAtEntry ? `${formatNumber(r.odometerAtEntry)} KM` : null].filter(Boolean).join(' · ')}
                      </T>
                    </View>
                    {r.amount ? <T variant="body">{formatNumber(r.amount)}</T> : null}
                  </Pressable>
                ))}
              </View>
            </>
          );
        }}
      </QueryBoundary>
    </Screen>
  );
}

const styles = StyleSheet.create({
  more: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  flex: {
    flex: 1,
  },
  head: {
    flexDirection: 'row',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.lg,
  },
  photo: {
    width: 104,
    height: 92,
    borderRadius: 4,
    backgroundColor: Colors.surfaceSand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  estimate: {
    backgroundColor: Colors.signalSoft,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    gap: 6,
  },
  estimateOdo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  approx: {
    fontFamily: FontFamily.semiBold,
    fontSize: 14,
    color: Colors.ink,
    marginBottom: 4,
  },
  block: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
    gap: 14,
  },
  between: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  row8: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  odo: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  odoValue: {
    marginTop: 6,
    marginBottom: 2,
  },
  service: {
    marginTop: 14,
    gap: 8,
  },
  readings: {
    width: 110,
    gap: 10,
    paddingTop: 4,
  },
  reading: {
    flexDirection: 'row',
    gap: 8,
  },
  readingTick: {
    width: 10,
    height: 1.5,
    backgroundColor: Colors.lineStrong,
    marginTop: 8,
  },
  readingSub: {
    fontSize: 10,
  },
  links: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: Colors.line,
    borderRadius: Radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  tl: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    paddingVertical: 6,
  },
  tlDate: {
    width: 48,
    paddingTop: 3,
  },
  quick: {
    flexDirection: 'row',
    gap: 8,
  },
  quickBtn: {
    flex: 1,
    paddingHorizontal: 8,
  },
});
