import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Screen } from '@/components/ui/Screen';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { TextField } from '@/components/ui/TextField';
import { T } from '@/components/ui/Typography';
import { QueryBoundary } from '@/components/data/QueryBoundary';
import { useActiveGarage, useGarageRecords, useVehicles } from '@/data/hooks';
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

  const [scope, setScope] = useState<'garage' | string>('garage');
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
    <Screen scroll contentStyle={styles.content}>
      <Pressable onPress={() => router.back()}>
        <T variant="eyebrowStrong" color={Colors.accent}>
          ← BACK
        </T>
      </Pressable>

      <T variant="eyebrowStrong" color={Colors.textMuted} style={styles.eyebrow}>
        EXPENSE REPORT
      </T>
      <T variant="display" style={styles.title}>
        Export a report
      </T>
      <T variant="body" color={Colors.textMuted} style={styles.subtitle}>
        Every record in the period, what it was, and who entered it. One car or the whole garage.
      </T>

      <QueryBoundary query={recordsQuery} isEmpty={() => false}>
        {() => (
          <>
            <SectionHeader title="Saved views" />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
              <Chip label="Monthly close" selected={false} onPress={() => {}} />
              <Chip label={savedThisView ? 'Saved ✓' : 'Save this'} onPress={() => setSavedThisView(true)} />
            </ScrollView>

            <SectionHeader title="What to cover" />
            <View style={styles.chipRow}>
              <Chip label="This vehicle" selected={scope !== 'garage'} onPress={() => setScope(vehicles[0]?.id ?? 'garage')} />
              <Chip label="Whole garage" selected={scope === 'garage'} onPress={() => setScope('garage')} />
            </View>
            {scope !== 'garage' ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                {vehicles.map((v) => (
                  <Chip key={v.id} label={`${v.make} ${v.model}`} selected={scope === v.id} onPress={() => setScope(v.id)} />
                ))}
              </ScrollView>
            ) : null}

            <SectionHeader title="Period" />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
              {(Object.keys(PERIOD_LABEL) as Period[]).map((p) => (
                <Chip key={p} label={PERIOD_LABEL[p]} selected={period === p} onPress={() => setPeriod(p)} />
              ))}
            </ScrollView>
            {period === 'custom' ? (
              <View style={styles.customDates}>
                <TextField label="From" value={customStart} onChangeText={setCustomStart} placeholder="YYYY-MM-DD" />
                <TextField label="To" value={customEnd} onChangeText={setCustomEnd} placeholder="YYYY-MM-DD" />
              </View>
            ) : null}
            <T variant="meta" style={styles.rangeText}>
              {formatDateWithYear(start)} – {formatDateWithYear(end)}
            </T>

            <SectionHeader title="Spent at" />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
              <Chip label="All places" selected={place === 'all'} onPress={() => setPlace('all')} />
              {places.map((p) => (
                <Chip key={p} label={p} selected={place === p} onPress={() => setPlace(p)} />
              ))}
            </ScrollView>

            {duplicateInfo.count > 0 ? (
              <>
                <SectionHeader title="A note for the reader" />
                <Card style={styles.dupCard}>
                  <T variant="bodyStrong" color={Colors.warning}>
                    {duplicateInfo.count} possible duplicate{duplicateInfo.count === 1 ? '' : 's'}
                    {duplicateInfo.first ? ` · ${formatPlate(vehicleById.get(duplicateInfo.first.vehicleId)?.plate)} ${formatDateShort(duplicateInfo.first.date)}` : ''}
                  </T>
                  <T variant="meta" color={Colors.warning}>
                    SAME VEHICLE, SAME DAY, SAME AMOUNT. CHECK BEFORE YOU SEND — NOTHING IS MERGED FOR YOU.
                  </T>
                </Card>
              </>
            ) : null}

            <T variant="meta" style={styles.sectionsNote}>
              SECTIONS APPEAR WHEN THE RECORDS SUPPORT THEM. WHAT IS LEFT OUT IS STATED ON THE FIRST PAGE.
            </T>

            <Card style={styles.summaryCard}>
              <T variant="numericLarge">{formatMoney(total)}</T>
              <T variant="meta">
                {filtered.length} RECORD{filtered.length === 1 ? '' : 'S'} · {formatMoney(total)}
              </T>
            </Card>

            <Button onPress={handleBuild} disabled={filtered.length === 0}>
              Build report · {filtered.length} record{filtered.length === 1 ? '' : 's'}
            </Button>
          </>
        )}
      </QueryBoundary>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: Spacing.sm,
  },
  eyebrow: {
    marginTop: Spacing.md,
  },
  title: {
    marginTop: Spacing.xxs,
  },
  subtitle: {
    marginTop: Spacing.xs,
    marginBottom: Spacing.md,
  },
  chipRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
    marginBottom: Spacing.md,
  },
  customDates: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  rangeText: {
    marginBottom: Spacing.lg,
  },
  dupCard: {
    marginBottom: Spacing.md,
    backgroundColor: Colors.warningSoft,
    gap: 2,
  },
  sectionsNote: {
    marginBottom: Spacing.md,
  },
  summaryCard: {
    marginBottom: Spacing.lg,
    gap: 4,
  },
});
