import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { QueryBoundary } from '@/components/data/QueryBoundary';
import { Footnote, MoneyFigure, ProgressBar, Rule, StatBox } from '@/components/ui/Blocks';
import { Segmented } from '@/components/ui/Chip';
import { Screen } from '@/components/ui/Screen';
import { T } from '@/components/ui/Typography';
import { TopBar } from '@/components/ui/TopBar';
import { useActiveWorkshop, useCurrency, useJobs, type Job } from '@/data/hooks';
import { jobTotal } from '@/features/mechanic/jobs';
import { formatNumber } from '@/lib/format';
import { Colors, Spacing } from '@/theme/tokens';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const INVOICED = new Set(['INVOICED', 'PARTIALLY_PAID', 'PAID']);

/** Workshop insights: the owner's Insights read as a workshop ledger — invoiced value, jobs, average job and what is still owed. */
export default function WorkshopInsightsScreen() {
  const workshop = useActiveWorkshop().data;
  const jobsQ = useJobs(workshop?.id ?? undefined);
  const currency = useCurrency();
  const [period, setPeriod] = useState<'month' | 'year' | 'all'>('year');
  const now = new Date();

  const invoiced = useMemo(() => (jobsQ.data ?? []).filter((j) => INVOICED.has(j.status)), [jobsQ.data]);
  const inPeriod = (j: Job) => {
    const d = new Date(j.updatedAt);
    if (period === 'all') return true;
    if (period === 'year') return d.getFullYear() === now.getFullYear();
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  };
  const rows = invoiced.filter(inPeriod);
  const total = rows.reduce((s, j) => s + jobTotal(j), 0);
  const owed = (jobsQ.data ?? []).filter((j) => j.status === 'INVOICED' || j.status === 'PARTIALLY_PAID').reduce((s, j) => s + jobTotal(j), 0);
  const months = Array.from({ length: now.getMonth() + 1 }, (_, m) => {
    const js = invoiced.filter((j) => {
      const d = new Date(j.updatedAt);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === m;
    });
    return { m, count: js.length, total: js.reduce((s, j) => s + jobTotal(j), 0) };
  });
  const max = Math.max(1, ...months.map((x) => x.total));

  return (
    <Screen padded={false} header={<TopBar backLabel="HOME" right="INSIGHTS" fallback="/mechanic/dashboard" />}>
      <View style={styles.pad}>
        <T variant="display" style={styles.title}>
          What the workshop earned
        </T>
      </View>
      <Rule bleed={false} />
      <QueryBoundary query={jobsQ} isEmpty={() => false}>
        {() => (
          <>
            <View style={[styles.pad, styles.block]}>
              <T variant="eyebrow" color={Colors.slate}>
                INVOICED THIS
              </T>
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
              <View style={styles.stats}>
                <StatBox label="JOBS CLOSED" value={formatNumber(rows.length)} />
                <StatBox label="AVERAGE JOB" value={formatNumber(rows.length ? total / rows.length : 0)} accent />
              </View>
              <Footnote color={Colors.textFaint}>INVOICED WORK ONLY · ESTIMATES NOT COUNTED · {currency} {formatNumber(owed)} STILL OWED</Footnote>
            </View>
            <Rule bleed={false} />
            <View style={[styles.pad, styles.block]}>
              <T variant="tag">MONTH BY MONTH</T>
              {months
                .slice()
                .reverse()
                .map((x) => (
                  <View key={x.m} style={styles.month}>
                    <View style={styles.monthHead}>
                      <View style={styles.flex}>
                        <T variant="bodyStrong">
                          {MONTHS[x.m]} {now.getFullYear()}
                        </T>
                        <T variant="eyebrow" color={Colors.slate}>
                          {x.count} JOB{x.count === 1 ? '' : 'S'} · AVERAGE {formatNumber(x.count ? x.total / x.count : 0)}
                        </T>
                      </View>
                      <T variant="body" color={Colors.ink}>
                        {formatNumber(x.total)}
                      </T>
                    </View>
                    <ProgressBar progress={x.total / max} height={3} />
                  </View>
                ))}
            </View>
          </>
        )}
      </QueryBoundary>
    </Screen>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: Spacing.lg },
  title: { paddingTop: Spacing.md, paddingBottom: Spacing.lg },
  block: { paddingVertical: Spacing.lg, gap: 14 },
  stats: { flexDirection: 'row', gap: 10 },
  month: { gap: 10, paddingVertical: 4 },
  monthHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  flex: { flex: 1, gap: 4 },
});
