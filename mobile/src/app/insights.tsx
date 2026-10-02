import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { QueryBoundary } from '@/components/data/QueryBoundary';
import { Footnote, MoneyFigure, ProgressBar, Rule, StatBox, TickBar } from '@/components/ui/Blocks';
import { Button } from '@/components/ui/Button';
import { Chip, Segmented } from '@/components/ui/Chip';
import { IconGlyph } from '@/components/ui/IconGlyph';
import { Screen } from '@/components/ui/Screen';
import { T } from '@/components/ui/Typography';
import { TopBar } from '@/components/ui/TopBar';
import { useActiveGarage, useCurrency, useGarageRecords, useUiState, useVehicles } from '@/data/hooks';
import { formatNumber } from '@/lib/format';
import { costPerKm, monthByMonth, monthsSpanned, periodRecords, periodTrend, spendColor, spendKey, SPEND_LABEL, sumAmount, type Period, type SpendKey } from '@/lib/spend';
import { CategoryColors, Colors, Spacing } from '@/theme/tokens';

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const GLYPH: Record<SpendKey, string> = { fuel: 'fuel', service: 'service', repair: 'repair', insurance: 'insurance', loan: 'loan', other: 'other' };

/** Insights: scope by garage or by car. Everything the old tabs held lives below the money. */
export default function InsightsScreen() {
  const garage = useActiveGarage().data;
  const vehicles = useVehicles(garage?.id).data ?? [];
  const recordsQuery = useGarageRecords(garage?.id);
  const homeVehicleId = useUiState('homeVehicleId');
  const currency = useCurrency();
  const [scope, setScope] = useState<string>(homeVehicleId ?? 'garage');
  const [period, setPeriod] = useState<Period>('year');

  const all = useMemo(() => recordsQuery.data ?? [], [recordsQuery.data]);
  const scoped = scope === 'garage' ? all : all.filter((r) => r.vehicleId === scope);
  const rows = periodRecords(scoped, period);
  const total = sumAmount(rows);
  const trend = periodTrend(scoped, period);
  const now = new Date();
  const months = period === 'month' ? 1 : period === 'year' ? now.getMonth() + 1 : monthsSpanned(rows);
  const perMonth = total / Math.max(1, months);
  const byMonth = monthByMonth(scoped, now);
  const maxMonth = Math.max(1, ...byMonth.map((m) => m.total));
  const cpk = costPerKm(scoped);

  const categories = (Object.keys(SPEND_LABEL) as SpendKey[])
    .map((k) => {
      const recs = rows.filter((r) => spendKey(r) === k);
      return { key: k, count: recs.length, amount: sumAmount(recs) };
    })
    .filter((c) => c.amount > 0)
    .sort((a, b) => b.amount - a.amount);

  const range =
    period === 'month'
      ? `1 ${MONTHS[now.getMonth()]} — ${now.getDate()} ${MONTHS[now.getMonth()]} ${now.getFullYear()}`
      : period === 'year'
        ? `1 JAN — ${now.getDate()} ${MONTHS[now.getMonth()]} ${now.getFullYear()}`
        : 'ALL RECORDS';

  return (
    <Screen padded={false} header={<TopBar backLabel="HOME" right="INSIGHTS" fallback="/home" />}>
      <View style={styles.pad}>
        <T variant="display" style={styles.title}>
          Where the money went
        </T>
      </View>
      <Rule bleed={false} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scopes}>
        <Chip label="Whole garage" selected={scope === 'garage'} onPress={() => setScope('garage')} />
        {vehicles.map((v) => (
          <Chip key={v.id} label={v.model} selected={scope === v.id} onPress={() => setScope(v.id)} />
        ))}
      </ScrollView>
      <Rule bleed={false} />

      <QueryBoundary query={recordsQuery} isEmpty={() => false}>
        {() => (
          <>
            <View style={[styles.pad, styles.block]}>
              <View style={styles.between}>
                <T variant="eyebrow" color={Colors.slate}>
                  SPENT THIS
                </T>
                {trend !== null ? (
                  <View style={styles.trend}>
                    <T variant="eyebrowStrong" color={Colors.accent}>
                      {trend >= 0 ? '↗' : '↘'} {Math.abs(trend).toFixed(1)}% on {period === 'year' ? now.getFullYear() - 1 : 'last month'}
                    </T>
                  </View>
                ) : null}
              </View>
              <Segmented
                value={period}
                onChange={setPeriod}
                options={[
                  { key: 'month', label: 'Month' },
                  { key: 'year', label: 'Year' },
                  { key: 'all', label: 'All time' },
                ]}
              />
              <MoneyFigure currency={currency} amount={formatNumber(total)} />
              <T variant="eyebrow" color={Colors.slate}>
                {range}
              </T>
              <View style={styles.stats}>
                <StatBox label="RECORDS" value={formatNumber(rows.length)} />
                <StatBox label="PER MONTH" value={formatNumber(perMonth)} accent />
              </View>
              <Footnote color={Colors.textFaint}>
                AVERAGE ACROSS {months} MONTH{months === 1 ? '' : 'S'} {period === 'all' ? 'OF RECORDS' : 'TO DATE'}
                {cpk ? ` · ${currency} ${cpk.toFixed(2)} PER KM` : ''}
              </Footnote>
            </View>
            <Rule bleed={false} />

            <View style={[styles.pad, styles.block]}>
              <T variant="tag">MONTH BY MONTH</T>
              {byMonth.map((m) => (
                <View key={m.key} style={styles.monthRow}>
                  <T variant="eyebrow" color={Colors.slate} style={styles.monthLabel}>
                    {m.label}
                  </T>
                  <View style={styles.flex}>
                    <TickBar progress={m.total / maxMonth} ticks={36} height={12} marker={false} />
                  </View>
                  <T variant="small" color={m.total === maxMonth && m.total > 0 ? Colors.accent : Colors.body} style={styles.monthValue}>
                    {formatNumber(m.total)}
                  </T>
                </View>
              ))}
            </View>
            <Rule bleed={false} />

            <View style={[styles.pad, styles.block]}>
              <T variant="tag">BY CATEGORY</T>
              {categories.length === 0 ? <T variant="meta">Nothing recorded in this period.</T> : null}
              {categories.map((c) => {
                const colors = CategoryColors[c.key === 'repair' ? 'repair' : c.key] ?? CategoryColors.other;
                return (
                  <View key={c.key} style={styles.cat}>
                    <View style={styles.catHead}>
                      <IconGlyph glyph={GLYPH[c.key]} size={30} shape="tile" bg={colors.bg} fg={colors.fg} />
                      <View style={styles.flex}>
                        <T variant="bodyStrong">{SPEND_LABEL[c.key]}</T>
                        <T variant="eyebrow" color={Colors.textFaint}>
                          {c.count} record{c.count === 1 ? '' : 's'} · {Math.round((c.amount / Math.max(1, total)) * 100)}%
                        </T>
                      </View>
                      <T variant="bodyStrong">{formatNumber(c.amount)}</T>
                    </View>
                    <ProgressBar progress={c.amount / Math.max(1, total)} color={spendColor(c.key)} height={3} />
                  </View>
                );
              })}
            </View>
            <View style={[styles.pad, styles.block]}>
              <Button variant="secondary" size="md" glyph="share" onPress={() => router.push({ pathname: '/reports/expense', params: scope !== 'garage' ? { vehicleId: scope } : {} })}>
                Export a report
              </Button>
            </View>
          </>
        )}
      </QueryBoundary>
    </Screen>
  );
}

const styles = StyleSheet.create({
  pad: {
    paddingHorizontal: Spacing.lg,
  },
  title: {
    paddingTop: Spacing.md,
    paddingBottom: Spacing.lg,
  },
  scopes: {
    gap: 8,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  block: {
    paddingVertical: Spacing.lg,
    gap: 14,
  },
  between: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  trend: {
    backgroundColor: Colors.accentSoft,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  stats: {
    flexDirection: 'row',
    gap: 10,
  },
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  monthLabel: {
    width: 48,
  },
  monthValue: {
    width: 64,
    textAlign: 'right',
  },
  flex: {
    flex: 1,
  },
  cat: {
    gap: 10,
    paddingVertical: 4,
  },
  catHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
});
