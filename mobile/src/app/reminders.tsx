import { StyleSheet } from 'react-native';

import { QueryBoundary } from '@/components/data/QueryBoundary';
import { Screen } from '@/components/ui/Screen';
import { T } from '@/components/ui/Typography';
import { TopBar } from '@/components/ui/TopBar';
import { useActiveGarage, useGarageReminders, useVehicles } from '@/data/hooks';
import { ReminderRow } from '@/features/activity/ReminderRow';
import { Spacing } from '@/theme/tokens';

/** Reminders. Each one carries its source. Distance reminders move when you log a reading. */
export default function RemindersScreen() {
  const garage = useActiveGarage().data;
  const vehicles = useVehicles(garage?.id).data ?? [];
  const remindersQuery = useGarageReminders(garage?.id);
  const reminders = (remindersQuery.data ?? []).filter((r) => !r.resolved);

  return (
    <Screen padded={false} header={<TopBar title="Reminders" right={`${reminders.length} set`} />} headerRule>
      <QueryBoundary
        query={remindersQuery}
        empty={{ glyph: 'reminder', title: 'Nothing due.', body: 'Carma adds reminders from service intervals and document expiry dates as you record them.' }}>
        {() => (
          <>
            {reminders.map((r) => (
              <ReminderRow key={r.id} reminder={r} vehicle={vehicles.find((v) => v.id === r.vehicleId)} />
            ))}
            <T variant="meta" style={styles.note}>
              Distance reminders move whenever you log a reading. Carma never guesses a date you did not give it.
            </T>
          </>
        )}
      </QueryBoundary>
    </Screen>
  );
}

const styles = StyleSheet.create({
  note: {
    padding: Spacing.lg,
  },
});
