import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { IconGlyph } from '@/components/ui/IconGlyph';
import { Screen } from '@/components/ui/Screen';
import { T } from '@/components/ui/Typography';
import { QueryBoundary } from '@/components/data/QueryBoundary';
import { useActiveGarage, useGarageReminders, useVehicles } from '@/data/hooks';
import { daysUntil, formatDistance, formatPlate } from '@/lib/format';
import { Colors, Radius, Spacing } from '@/theme/tokens';

const COUNT_WORDS = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten'];
function spellCount(n: number): string {
  return n <= 10 ? COUNT_WORDS[n] : String(n);
}

export default function RemindersScreen() {
  const garageQuery = useActiveGarage();
  const garage = garageQuery.data;
  const vehiclesQuery = useVehicles(garage?.id);
  const vehicles = vehiclesQuery.data ?? [];
  const remindersQuery = useGarageReminders(garage?.id);
  const reminders = remindersQuery.data ?? [];
  const vehicleById = new Map(vehicles.map((v) => [v.id, v] as const));

  const nearest = reminders
    .filter((r) => r.dueDate)
    .map((r) => daysUntil(r.dueDate!))
    .sort((a, b) => a - b)[0];

  return (
    <Screen scroll contentStyle={styles.content}>
      <T variant="eyebrowStrong" color={Colors.textMuted}>REMINDERS</T>
      <T variant="display" style={styles.title}>
        {reminders.length > 0 ? `${spellCount(reminders.length)} thing${reminders.length === 1 ? '' : 's'} are coming up` : 'Nothing due right now'}
      </T>
      {nearest != null ? (
        <View style={styles.nearestBlock}>
          <T variant="numericLarge">{Math.max(0, nearest)}</T>
          <T variant="eyebrow">DAYS TO THE NEAREST</T>
        </View>
      ) : null}

      <QueryBoundary query={remindersQuery} isEmpty={() => false}>
        {() =>
          reminders.length === 0 ? (
            <EmptyState glyph="reminder" title="All caught up." body="Carma sets reminders from your odometer, document expiry dates, pending estimates and stalled projects." />
          ) : (
            reminders.map((r) => {
              const v = vehicleById.get(r.vehicleId);
              const kmPassed = r.dueKm != null && v ? v.odometerKm - r.dueKm : null;
              const overdue = r.dueDate ? daysUntil(r.dueDate) < 0 : kmPassed != null ? kmPassed >= 0 : false;
              const days = r.dueDate ? daysUntil(r.dueDate) : null;
              return (
                <Card key={r.id} style={styles.card} onPress={() => v && router.push(`/vehicle/${v.id}`)}>
                  <View style={styles.cardRow}>
                    <IconGlyph glyph={r.kind === 'service-due' ? 'service' : r.kind === 'document-expiry' ? 'document' : r.kind === 'estimate-pending' ? 'estimate' : 'build'} size={36} />
                    <View style={styles.cardText}>
                      <T variant="bodyStrong">{r.description}</T>
                      {kmPassed != null ? (
                        <T variant="meta">
                          DUE AT {formatDistance(r.dueKm!)} · {kmPassed >= 0 ? 'PASSED' : ''} {formatDistance(Math.abs(kmPassed))} {kmPassed >= 0 ? 'AGO' : 'AWAY'}
                        </T>
                      ) : v ? (
                        <T variant="meta">
                          {v.make} {v.model} · {formatPlate(v.plate)}
                        </T>
                      ) : null}
                    </View>
                    {kmPassed != null ? (
                      <View style={[styles.pill, overdue && styles.pillDanger]}>
                        <T variant="meta" color={overdue ? Colors.error : Colors.textMuted} style={{ fontFamily: undefined }}>
                          {overdue ? 'OVERDUE' : formatDistance(Math.abs(kmPassed))}
                        </T>
                      </View>
                    ) : days != null ? (
                      <View style={[styles.pill, overdue && styles.pillDanger]}>
                        <T variant="meta" color={overdue ? Colors.error : Colors.textMuted} style={{ fontFamily: undefined }}>
                          {overdue ? 'OVERDUE' : `${days} DAYS`}
                        </T>
                      </View>
                    ) : null}
                  </View>
                </Card>
              );
            })
          )
        }
      </QueryBoundary>

      <T variant="meta" center style={styles.footnote}>
        CARMA SETS REMINDERS FROM YOUR ODOMETER, DOCUMENT EXPIRY DATES, PENDING ESTIMATES AND STALLED PROJECTS.
      </T>
      <Button variant="secondary" onPress={() => vehicles[0] && router.push(`/vehicle/${vehicles[0].id}`)}>
        + New reminder
      </Button>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: Spacing.sm,
  },
  title: {
    marginTop: Spacing.xs,
  },
  nearestBlock: {
    marginVertical: Spacing.md,
    gap: 2,
  },
  card: {
    marginBottom: Spacing.sm,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  cardText: {
    flex: 1,
    gap: 2,
  },
  pill: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Radius.pill,
    backgroundColor: Colors.surfaceMuted,
  },
  pillDanger: {
    backgroundColor: Colors.dangerSoft,
  },
  footnote: {
    marginTop: Spacing.md,
    marginBottom: Spacing.md,
  },
});
