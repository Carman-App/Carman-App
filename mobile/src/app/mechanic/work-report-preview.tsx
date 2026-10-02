import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { QueryBoundary } from '@/components/data/QueryBoundary';
import { MoneyFigure } from '@/components/ui/Blocks';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { T } from '@/components/ui/Typography';
import { TopBar } from '@/components/ui/TopBar';
import { setJobStatus, useActiveWorkshop, useCurrency, useJob, useJobs } from '@/data/hooks';
import { jobNumber, jobTotal } from '@/features/mechanic/jobs';
import { formatNumber } from '@/lib/format';
import { Colors, Radius, Spacing } from '@/theme/tokens';

/** Customer estimate preview: the same estimate as the owner receives it. Sending moves the job to waiting on the owner. */
export default function EstimatePreviewScreen() {
  const { jobId } = useLocalSearchParams<{ jobId: string }>();
  const jobQ = useJob(jobId);
  const workshop = useActiveWorkshop().data;
  const all = useJobs(workshop?.id ?? undefined).data ?? [];
  const currency = useCurrency();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <QueryBoundary query={jobQ} isEmpty={() => false}>
      {(job) => {
        const send = async () => {
          setBusy(true);
          setError(null);
          try {
            if (job.status === 'INTAKE') await setJobStatus(job, 'AWAITING_APPROVAL');
            router.dismissTo?.({ pathname: '/mechanic/job-detail', params: { id: job.id } });
          } catch (e) {
            setError(e instanceof Error ? e.message : 'Could not send.');
            setBusy(false);
          }
        };
        return (
          <Screen
            header={<TopBar title="Preview" right={job.status === 'INTAKE' ? 'Not sent' : 'Sent'} />}
            footer={
              <>
                {error ? (
                  <T variant="meta" color={Colors.danger} center>
                    {error}
                  </T>
                ) : null}
                <View style={styles.actions}>
                  <Button fullWidth={false} style={styles.edit} onPress={() => router.back()}>
                    Edit
                  </Button>
                  <Button style={styles.flex} loading={busy} onPress={send}>
                    Send it
                  </Button>
                </View>
              </>
            }>
            <View style={styles.banner}>
              <T variant="eyebrow" color={Colors.white}>
                THIS IS WHAT {(job.customer?.name ?? 'THE OWNER').toUpperCase()} SEES IN THEIR OWN CARMA
              </T>
            </View>
            <View style={styles.card}>
              <View style={styles.from}>
                <Avatar name={workshop?.name ?? 'Workshop'} size={36} />
                <View>
                  <T variant="bodyStrong">{workshop?.name ?? 'Workshop'}</T>
                  <T variant="eyebrow" color={Colors.slate}>
                    ESTIMATE · JOB {jobNumber(job, all.length ? all : [job])}
                  </T>
                </View>
              </View>
              <View style={styles.inner}>
                <T variant="eyebrow" color={Colors.slate}>
                  {(job.vehicleDescription ?? 'Vehicle').toUpperCase()}
                </T>
                <MoneyFigure currency={currency} amount={formatNumber(jobTotal(job))} size="md" />
                <T variant="body">{job.faultDescription}</T>
                {job.lines.map((l) => (
                  <View key={l.id} style={styles.line}>
                    <View style={styles.flex}>
                      <T variant="bodyStrong">{l.description}</T>
                      <T variant="eyebrow" color={Colors.slate}>
                        {l.kind}
                      </T>
                    </View>
                    <T variant="body" color={Colors.ink}>
                      {formatNumber(l.cost)}
                    </T>
                  </View>
                ))}
                <View style={styles.actions}>
                  <Button variant="secondary" size="sm" fullWidth={false} disabled>
                    Ask a question
                  </Button>
                  <Button size="sm" style={styles.flex} disabled>
                    Approve
                  </Button>
                </View>
              </View>
            </View>
          </Screen>
        );
      }}
    </QueryBoundary>
  );
}

const styles = StyleSheet.create({
  banner: { backgroundColor: Colors.ink, borderRadius: Radius.sm, padding: 14, marginTop: Spacing.sm },
  card: { marginTop: Spacing.md, borderWidth: 1, borderColor: Colors.line, borderRadius: Radius.lg, overflow: 'hidden' },
  from: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.borderSoft },
  inner: { padding: Spacing.md, gap: 12 },
  line: { flexDirection: 'row', gap: Spacing.sm, paddingVertical: 8, borderTopWidth: 1, borderTopColor: Colors.borderSoft },
  actions: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  edit: { paddingHorizontal: Spacing.lg },
  flex: { flex: 1, gap: 4 },
});
