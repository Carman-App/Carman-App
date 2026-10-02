import { router, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';

import { ScreenTitle } from '@/components/ui/Blocks';
import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { T } from '@/components/ui/Typography';
import { TopBar } from '@/components/ui/TopBar';
import { useActiveWorkshop, useJobs, useWorkshopCustomers } from '@/data/hooks';
import { JobRow } from '@/features/mechanic/JobRow';
import { Spacing } from '@/theme/tokens';

/** One customer and every job opened for them. */
export default function CustomerDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const workshop = useActiveWorkshop().data;
  const customer = (useWorkshopCustomers(workshop?.id ?? undefined).data ?? []).find((c) => c.id === id);
  const all = useJobs(workshop?.id ?? undefined).data ?? [];
  const jobs = all.filter((j) => j.customerId === id);

  return (
    <Screen padded={false} header={<TopBar backLabel="CUSTOMERS" />} footer={<Button glyph="add" onPress={() => router.push('/mechanic/new-job')}>New job</Button>}>
      <View style={{ paddingHorizontal: Spacing.lg }}>
        <ScreenTitle title={customer?.name ?? 'Customer'} lede={[customer?.phone, customer?.notes].filter(Boolean).join(' · ') || undefined} />
      </View>
      {jobs.length === 0 ? (
        <T variant="meta" style={{ padding: Spacing.lg }}>
          No jobs yet.
        </T>
      ) : (
        jobs.map((j) => <JobRow key={j.id} job={j} all={all} />)
      )}
    </Screen>
  );
}
