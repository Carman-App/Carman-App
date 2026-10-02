import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Dot } from '@/components/ui/Blocks';
import { ChoiceRow } from '@/components/ui/ChoiceRow';
import { Chip } from '@/components/ui/Chip';
import { Screen } from '@/components/ui/Screen';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { TextField } from '@/components/ui/TextField';
import { T } from '@/components/ui/Typography';
import { TopBar } from '@/components/ui/TopBar';
import { QueryBoundary } from '@/components/data/QueryBoundary';
import { useActiveGarage, useCurrency, useGarageRecords, useVehicles } from '@/data/hooks';
import { formatDateShort, formatDateWithYear, formatMoney, formatPlate, todayIso } from '@/lib/format';
import { Colors, Spacing } from '@/theme/tokens';

type Period = 'month' | 'lastMonth' | 'quarter' | 'ytd' | 'taxYear' | 'custom';

const PERIOD_LABEL: Record<Period, string> = {
  month: 'This month',
  lastMonth: 'Last month',
  quarter: 'This quarter',
  ytd: 'Year to date',
  taxYear: 'Tax year',
  custom: 'Pick your own dates',
};

function pad(n: number) {
  return String(n).padStart(2, '0');
}
function iso(y: number, m: number, d: number) {
  return `${y}-${pad(m + 1)}-${pad(d)}`;
}

function periodBounds(period: Period, customStart: string, customEnd: string, now: Date) {
  const year = now.getFullYear();
  const today = todayIso();
  if (period === 'month') return { start: iso(year, now.getMonth(), 1), end: today };
  if (period === 'lastMonth') {
    const prev = new Date(year, now.getMonth() - 1, 1);
    const lastDay = new Date(year, now.getMonth(), 0).getDate();
    return { start: iso(prev.getFullYear(), prev.getMonth(), 1), end: iso(prev.getFullYear(), prev.getMonth(), lastDay) };
  }
  if (period === 'quarter') {
    const qStart = Math.floor(now.getMonth() / 3) * 3;
    return { start: iso(year, qStart, 1), end: today };
  }
  if (period === 'taxYear') return { start: iso(year, 0, 1), end: iso(year, 11, 31) };
  if (period === 'custom') return { start: customStart || iso(year, 0, 1), end: customEnd || today };
  return { start: iso(year, 0, 1), end: today }; // ytd
}

export default function ExpenseReportConfigScreen() {
  const garageQuery = useActiveGarage();
  const vehiclesQuery = useVehicles(garageQuery.data?.id);
  const recordsQuery = useGarageRecords(garageQuery.data?.id);
  const vehicles = vehiclesQuery.data ?? [];
  const allRecords = recordsQuery.data ?? [];

  const { vehicleId } = useLocalSearchParams<{ vehicleId?: string }>();
  const currency = useCurrency();
  const [scope, setScope] = useState<'garage' | string>(vehicleId || 'garage');
  const [period, setPeriod] = useState<Period>('ytd');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [place, setPlace] = useState('all');
  const [savedThisView, setSavedThisView] = useState(false);

  const now = useMemo(() => new Date(), []);
  const { start, end } = useMemo(() => periodBounds(period, customStart, customEnd, now), [period, customStart, customEnd, now]);

  const scoped = scope === 'garage' ? allRecords : allRecords.filter((r) => r.vehicleId === scope);
  const periodRecords = useMemo(() => scoped.filter((r) => r.date >= start && r.date <= end), [scoped, start, end]);

  const places = useMemo(
    () => Array.from(new Set(periodRecords.map((r) => r.place).filter((p): p is string => !!p))).sort((a, b) => a.localeCompare(b)),
    [periodRecords]
  );

  const filtered = place === 'all' ? periodRecords : periodRecords.filter((r) => r.place === place);
  const total = filtered.reduce((s, r) => s + r.amount, 0);
  const vehicleById = new Map(vehicles.map((v) => [v.id, v] as const));

  const duplicateInfo = useMemo(() => {
    const seen = new Map<string, typeof filtered>();
    for (const r of filtered) {
      const key = `${r.vehicleId}|${r.date}|${r.amount}`;
      const list = seen.get(key) ?? [];
      list.push(r);
      seen.set(key, list);
    }
    const groups = Array.from(seen.values()).filter((list) => list.length > 1);
    return { count: groups.length, first: groups[0]?.[0] };
  }, [filtered]);

  const handleBuild = () => {
    router.push({
      pathname: '/reports/preview',
      params: {
        scope: scope === 'garage' ? 'garage' : 'vehicle',
        vehicleId: scope === 'garage' ? '' : scope,
        start,
        end,
        place,
      },
    });
  };

  return (
    <Screen
      padded={false}
      header={<TopBar backLabel="BACK" right="EXPENSE REPORT" />}
      footer={
        <>
          <View style={styles.summary}>
            <Dot color={Colors.accent} size={6} />
            <T variant="eyebrow" color={Colors.slate}>
              {filtered.length} RECORD{filtered.length === 1 ? '' : 'S'} · {formatDateWithYear(start).toUpperCase()} — {formatDateWithYear(end).toUpperCase()} · {formatMoney(total, currency)}
            </T>
          </View>
          <Button onPress={handleBuild} disabled={filtered.length === 0}>
            {filtered.length === 0 ? 'No records in this period' : 'Build the report'}
          </Button>
        </>
      }>
      <View style={styles.head}>
        <T variant="display">Export a report</T>
        <T variant="lede">Every record in the period, what it was, and who entered it. One car or the whole garage.</T>
      </View>
      <QueryBoundary query={recordsQuery} isEmpty={() => false}>
        {() => (
          <>
            <SectionHeader title="SAVED VIEWS" rule inset />
            <View style={styles.chips}>
              <Chip caps label="Monthly · whole garage" onPress={() => { setScope('garage'); setPeriod('month'); }} />
              <Chip caps label="Year to date" onPress={() => setPeriod('ytd')} />
              <Chip caps label={savedThisView ? 'Saved ✓' : 'Save this'} onPress={() => setSavedThisView(true)} />
            </View>

            <SectionHeader title="WHAT TO COVER" rule inset />
            {vehicles.map((v) => (
              <ChoiceRow key={v.id} glyph={v.type === 'motorcycle' ? 'motorcycle' : 'vehicle'} title={`${v.make} ${v.model}`} sub={`ONE CAR · ${formatPlate(v.plate)}`} subCaps selected={scope === v.id} onPress={() => setScope(v.id)} />
            ))}
            <ChoiceRow glyph="home" title="The whole garage" sub={`${vehicles.length} VEHICLES`} subCaps selected={scope === 'garage'} onPress={() => setScope('garage')} />

            <SectionHeader title="PERIOD" rule inset />
            {(Object.keys(PERIOD_LABEL) as Period[]).map((p) => (
              <ChoiceRow
                key={p}
                glyph="date"
                title={PERIOD_LABEL[p]}
                sub={p === period ? `${formatDateWithYear(start)} — ${formatDateWithYear(end)}`.toUpperCase() : undefined}
                subCaps
                selected={period === p}
                onPress={() => setPeriod(p)}
              />
            ))}
            {period === 'custom' ? (
              <View style={styles.custom}>
                <TextField label="From" value={customStart} onChangeText={setCustomStart} placeholder="YYYY-MM-DD" style={styles.flex} />
                <TextField label="To" value={customEnd} onChangeText={setCustomEnd} placeholder="YYYY-MM-DD" style={styles.flex} />
              </View>
            ) : null}

            {places.length > 0 ? (
              <>
                <SectionHeader title="SPENT AT" rule inset />
                <View style={styles.chips}>
                  <Chip label="All places" selected={place === 'all'} onPress={() => setPlace('all')} />
                  {places.map((p) => (
                    <Chip key={p} label={p} selected={place === p} onPress={() => setPlace(p)} />
                  ))}
                </View>
              </>
            ) : null}

            {duplicateInfo.count > 0 ? (
              <View style={styles.dup}>
                <T variant="bodyStrong" color={Colors.warning}>
                  {duplicateInfo.count} possible duplicate{duplicateInfo.count === 1 ? '' : 's'}
                  {duplicateInfo.first ? ` · ${formatPlate(vehicleById.get(duplicateInfo.first.vehicleId)?.plate)} ${formatDateShort(duplicateInfo.first.date)}` : ''}
                </T>
                <T variant="eyebrow" color={Colors.warning}>
                  SAME VEHICLE, SAME DAY, SAME AMOUNT. CHECK BEFORE YOU SEND — NOTHING IS MERGED FOR YOU.
                </T>
              </View>
            ) : null}
          </>
        )}
      </QueryBoundary>
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.lg,
    gap: 12,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
  },
  custom: {
    flexDirection: 'row',
    gap: Spacing.sm,
    padding: Spacing.lg,
  },
  flex: {
    flex: 1,
  },
  dup: {
    backgroundColor: Colors.warningSoft,
    padding: Spacing.lg,
    gap: 6,
  },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 4,
  },
});
