import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { QueryBoundary } from '@/components/data/QueryBoundary';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Screen } from '@/components/ui/Screen';
import { T } from '@/components/ui/Typography';
import { TopBar } from '@/components/ui/TopBar';
import { useActiveWorkshop, useJobs } from '@/data/hooks';
import { GROUP_LABEL, STATUS_META, isOpen, type JobGroup } from '@/features/mechanic/jobs';
import { JobRow } from '@/features/mechanic/JobRow';
import { Colors, Spacing } from '@/theme/tokens';

type Filter = 'all' | JobGroup;

const BAR: Record<JobGroup, string> = {
  waiting: Colors.cta,
  progress: Colors.accent,
  ready: Colors.positive,
  owed: Colors.orange,
  closed: Colors.chipStrong,
};

/** Job board, grouped by state: yellow waiting on the owner, blue in progress, green ready, orange owed. */
export default function JobBoardScreen() {
  const workshop = useActiveWorkshop().data;
  const jobsQ = useJobs(workshop?.id ?? undefined);
  const jobs = useMemo(() => jobsQ.data ?? [], [jobsQ.data]);
  const [filter, setFilter] = useState<Filter>('all');
  const open = jobs.filter(isOpen).length;
  const order: JobGroup[] = ['waiting', 'progress', 'ready', 'owed', 'closed'];

  const groups = order
    .filter((g) => filter === 'all' ? g !== 'closed' : g === filter)
    .map((g) => ({ g, items: jobs.filter((j) => STATUS_META[j.status].group === g) }))
    .filter((x) => x.items.length > 0);

  return (
    <Screen
      padded={false}
      header={<TopBar title="Jobs" right={`${open} open`} fallback="/mechanic/dashboard" />}
      footer={
        <Button glyph="add" onPress={() => router.push('/mechanic/new-job')}>
          New job
        </Button>
      }>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
        {(
          [
            ['all', 'All'],
            ['waiting', 'Waiting'],
            ['progress', 'In progress'],
            ['ready', 'Ready'],
            ['owed', 'Invoiced'],
            ['closed', 'Closed'],
          ] as [Filter, string][]
        ).map(([k, l]) => (
          <Chip key={k} label={l} selected={filter === k} onPress={() => setFilter(k)} />
        ))}
      </ScrollView>
      <QueryBoundary query={jobsQ} empty={{ glyph: 'service', title: 'No jobs yet.', body: 'Open the first job: a customer, their vehicle and the reported problem.' }}>
        {() =>
          groups.length === 0 ? (
            <T variant="meta" style={styles.none}>
              Nothing here.
            </T>
          ) : (
            groups.map(({ g, items }) => (
              <View key={g}>
                <View style={styles.groupHead}>
                  <View style={[styles.bar, { backgroundColor: BAR[g] }]} />
                  <T variant="meta" color={Colors.ink} style={styles.flex}>
                    {GROUP_LABEL[g]}
                  </T>
                  <T variant="meta">{items.length}</T>
                </View>
                {items.map((j) => (
                  <JobRow key={j.id} job={j} all={jobs} />
                ))}
              </View>
            ))
          )
        }
      </QueryBoundary>
    </Screen>
  );
}

const styles = StyleSheet.create({
  filters: {
    gap: 8,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
  },
  groupHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  bar: {
    width: 3,
    height: 16,
  },
  flex: {
    flex: 1,
  },
  none: {
    padding: Spacing.lg,
  },
});
