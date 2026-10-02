import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { QueryBoundary } from '@/components/data/QueryBoundary';
import { Dot, KeyValueRow, Notice } from '@/components/ui/Blocks';
import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { T } from '@/components/ui/Typography';
import { TopBar } from '@/components/ui/TopBar';
import { setJobStatus, useActiveWorkshop, useCurrency, useJob, useJobs, type Job } from '@/data/hooks';
import { NEXT_STEP, STATUS_META, jobNumber, jobTotal } from '@/features/mechanic/jobs';
import { formatDateShort, formatNumber } from '@/lib/format';
import { Colors, FontFamily, Radius, Spacing } from '@/theme/tokens';

const KIND_LABEL = { PART: 'Part', LABOUR: 'Labour', SERVICE: 'Service', FLUID: 'Fluid' } as const;

/** Job detail: the reported problem on a blue bar, the job's fields, its lines, then the next step. */
export default function JobDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const jobQ = useJob(id);
  const workshop = useActiveWorkshop().data;
  const all = useJobs(workshop?.id ?? undefined).data ?? [];
  const currency = useCurrency();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const advance = async (job: Job) => {
    const next = NEXT_STEP[job.status];
    if (!next) return;
    if (job.status === 'INTAKE') {
      router.push({ pathname: '/mechanic/estimate-builder', params: { jobId: job.id } });
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await setJobStatus(job, next.to);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update the job.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <QueryBoundary query={jobQ} isEmpty={() => false}>
      {(job) => {
        const s = STATUS_META[job.status];
        const next = NEXT_STEP[job.status];
        const editable = ['INTAKE', 'AWAITING_APPROVAL', 'APPROVED', 'IN_PROGRESS'].includes(job.status);
        return (
          <Screen
            padded={false}
            header={
              <TopBar
                title={`Job ${jobNumber(job, all.length ? all : [job])}`}
                right={
                  <View style={styles.state}>
                    <Dot color={s.color} />
                    <T variant="meta">{s.label}</T>
                  </View>
                }
              />
            }
            headerRule
            footer={
              <>
                {error ? (
                  <T variant="meta" color={Colors.danger} center>
                    {error}
                  </T>
                ) : null}
                <View style={styles.actions}>
                  {editable ? (
                    <Button variant="secondary" style={styles.flex} onPress={() => router.push({ pathname: '/mechanic/add-job-line', params: { jobId: job.id } })}>
                      Add a line
                    </Button>
                  ) : null}
                  {next ? (
                    <Button style={styles.flex} loading={busy} disabled={job.status === 'INTAKE' && job.lines.length === 0} onPress={() => advance(job)}>
                      {next.label}
                    </Button>
                  ) : null}
                </View>
              </>
            }>
            <View style={styles.head}>
              <T variant="display">{job.customer?.name ?? 'Customer'}</T>
              <T variant="meta">{job.vehicleDescription ?? 'Vehicle not described'}</T>
              <View style={styles.tags}>
                <View style={[styles.tag, { backgroundColor: s.tint }]}>
                  <T style={[styles.tagText, { color: s.color === Colors.cta ? Colors.warning : s.color }]}>
                    {s.label} {formatDateShort(job.updatedAt.slice(0, 10))}
                  </T>
                </View>
              </View>
            </View>
            <Notice>
              <T variant="body" color={Colors.ink}>
                {job.faultDescription}
              </T>
              <T variant="small" style={{ marginTop: 6 }}>
                Reported by owner · {formatDateShort(job.createdAt.slice(0, 10))}
              </T>
            </Notice>
            <View style={styles.pad}>
              <KeyValueRow label="Customer" value={job.customer?.name ?? '—'} sub={job.customer?.phone ?? undefined} />
              <KeyValueRow label="Work" value={job.lines.length ? `${job.lines.length} line${job.lines.length === 1 ? '' : 's'}` : 'No lines yet'} />
              <KeyValueRow label="Total" value={`${currency} ${formatNumber(jobTotal(job))}`} last />
            </View>
            <View style={styles.lines}>
              <T variant="section">Lines</T>
              {job.lines.length === 0 ? (
                <T variant="meta">Add parts and labour as separate lines. The owner approves them before work starts.</T>
              ) : (
                job.lines.map((l) => (
                  <View key={l.id} style={styles.line}>
                    <View style={styles.flex}>
                      <T variant="bodyStrong">{l.description}</T>
                      <T variant="eyebrow" color={Colors.slate}>
                        {KIND_LABEL[l.kind]} · {formatDateShort(l.createdAt.slice(0, 10))}
                      </T>
                    </View>
                    <T variant="body" color={Colors.ink}>
                      {formatNumber(l.cost)}
                    </T>
                  </View>
                ))
              )}
            </View>
          </Screen>
        );
      }}
    </QueryBoundary>
  );
}

const styles = StyleSheet.create({
  state: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  head: {
    padding: Spacing.lg,
    gap: 8,
  },
  tags: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  tag: {
    borderRadius: Radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  tagText: {
    fontFamily: FontFamily.medium,
    fontSize: 12,
  },
  pad: {
    paddingHorizontal: Spacing.lg,
  },
  lines: {
    padding: Spacing.lg,
    gap: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  line: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderSoft,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  flex: {
    flex: 1,
    gap: 6,
  },
});
