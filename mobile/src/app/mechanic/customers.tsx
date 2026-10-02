import { router } from 'expo-router';

import { QueryBoundary } from '@/components/data/QueryBoundary';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { ListRow } from '@/components/ui/ListRow';
import { Screen } from '@/components/ui/Screen';
import { TopBar } from '@/components/ui/TopBar';
import { useActiveWorkshop, useJobs, useWorkshopCustomers } from '@/data/hooks';

/** Customers: everyone the workshop has opened a job for. */
export default function CustomersScreen() {
  const workshop = useActiveWorkshop().data;
  const customersQ = useWorkshopCustomers(workshop?.id ?? undefined);
  const jobs = useJobs(workshop?.id ?? undefined).data ?? [];

  return (
    <Screen
      header={<TopBar title="Customers" right={workshop?.name} fallback="/mechanic/dashboard" />}
      headerRule
      footer={
        <Button glyph="user-add" onPress={() => router.push('/mechanic/add-customer')}>
          Add a customer
        </Button>
      }>
      <QueryBoundary query={customersQ} empty={{ glyph: 'members', title: 'No customers yet.', body: 'A name and a phone number is enough to start.' }}>
        {(customers) =>
          customers.map((c) => {
            const n = jobs.filter((j) => j.customerId === c.id).length;
            return (
              <ListRow
                key={c.id}
                left={<Avatar name={c.name} />}
                title={c.name}
                subtitle={c.phone ?? 'No phone'}
                meta={`${n} job${n === 1 ? '' : 's'}`}
                chevron
                onPress={() => router.push({ pathname: '/mechanic/customer-detail', params: { id: c.id } })}
              />
            );
          })
        }
      </QueryBoundary>
    </Screen>
  );
}
