import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { QueryBoundary } from '@/components/data/QueryBoundary';
import { Button } from '@/components/ui/Button';
import { IconGlyph } from '@/components/ui/IconGlyph';
import { Screen } from '@/components/ui/Screen';
import { T } from '@/components/ui/Typography';
import { TopBar } from '@/components/ui/TopBar';
import { useActiveWorkshop, useCurrency, useJob, useJobs } from '@/data/hooks';
import { jobNumber, jobTotal } from '@/features/mechanic/jobs';
import { formatNumber } from '@/lib/format';
import { Colors, Spacing } from '@/theme/tokens';

/** Before it sends: every consequence named before the estimate goes to the owner. */
export default function BeforeItSendsScreen() {
  const { jobId } = useLocalSearchParams<{ jobId: string }>();
  const jobQ = useJob(jobId);
  const workshop = useActiveWorkshop().data;
  const all = useJobs(workshop?.id ?? undefined).data ?? [];
  const currency = useCurrency();

  return (
    <QueryBoundary query={jobQ} isEmpty={() => false}>
      {(job) => {
        const first = job.customer?.name.split(' ')[0] ?? 'the owner';
        const num = jobNumber(job, all.length ? all : [job]);
        const effects = [
          { glyph: 'add', tint: Colors.accentSoft, hue: Colors.accent, title: `${job.lines.length} line${job.lines.length === 1 ? '' : 's'} on job ${num}`, sub: 'PARTS AND LABOUR AS SEPARATE LINES' },
          { glyph: 'estimate', tint: Colors.ctaSoft, hue: Colors.warning, title: `${first} gets an approval request`, sub: `${currency} ${formatNumber(jobTotal(job))} FOR THE WORK` },
          { glyph: 'timeline', tint: Colors.chip, hue: Colors.textMuted, title: 'Job state moves to waiting on the owner', sub: 'YELLOW ON THE JOB BOARD UNTIL THEY ANSWER' },
        ];
        return (
          <Screen
            padded={false}
            header={<TopBar title="Before it sends" right={`${job.lines.length} lines`} />}
            headerRule
            footer={
              <Button disabled={job.lines.length === 0} onPress={() => router.push({ pathname: '/mechanic/work-report-preview', params: { jobId: job.id } })}>
                Preview and send
              </Button>
            }>
            <View style={styles.head}>
              <T variant="display">
                {currency} {formatNumber(jobTotal(job))} to {first}
              </T>
              <T variant="lede">Nothing is done to the car until {first} approves it in Carma.</T>
            </View>
            <T variant="eyebrow" color={Colors.slate} style={styles.label}>
              WHAT THIS WILL DO
            </T>
            {effects.map((e) => (
              <View key={e.title} style={styles.row}>
                <IconGlyph glyph={e.glyph} size={28} bg={e.tint} fg={e.hue} scale={0.55} />
                <View style={styles.flex}>
                  <T variant="bodyStrong">{e.title}</T>
                  <T variant="eyebrow" color={Colors.slate}>
                    {e.sub}
                  </T>
                </View>
              </View>
            ))}
            <T variant="meta" style={styles.note}>
              Nothing sends until you tap. Lines stay on the job and can be edited until the owner answers.
            </T>
          </Screen>
        );
      }}
    </QueryBoundary>
  );
}

const styles = StyleSheet.create({
  head: { padding: Spacing.lg, gap: 12 },
  label: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: Colors.borderSoft,
  },
  flex: { flex: 1, gap: 6 },
  note: { padding: Spacing.lg, borderTopWidth: 1, borderTopColor: Colors.borderSoft },
});
