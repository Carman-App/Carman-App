import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Footnote } from '@/components/ui/Blocks';
import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { T } from '@/components/ui/Typography';
import { useAccount, useVehicle } from '@/data/hooks';
import { formatDateLong, formatNumber, todayIso } from '@/lib/format';
import { Colors, Spacing } from '@/theme/tokens';
import { REGION_UNITS } from '@/types/domain';

/** Confirmation after "Make these changes": the blue disc, what was written, and where to go next. */
export default function RecordSavedScreen() {
  const { vehicleId, amount, kind, reading } = useLocalSearchParams<{ vehicleId?: string; amount?: string; kind?: string; reading?: string }>();
  const vehicle = useVehicle(vehicleId).data;
  const account = useAccount().data;
  const currency = account ? (REGION_UNITS[account.region]?.currency ?? 'KES') : 'KES';
  const isReading = kind === 'odometer';

  return (
    <Screen
      footer={
        <>
          <Button onPress={() => router.replace('/home')}>Back to Home</Button>
          <Button variant="ghost" size="md" onPress={() => router.replace(vehicleId ? `/vehicle/${vehicleId}/timeline` : '/home')}>
            See it on the timeline
          </Button>
        </>
      }>
      <View style={styles.body}>
        <View style={styles.badgeRow}>
          <View style={styles.disc} />
          <View style={styles.pill}>
            <T variant="eyebrowStrong" color={Colors.accent}>
              SAVED
            </T>
          </View>
        </View>
        <T variant="display">
          {isReading
            ? `${formatNumber(Number(reading) || vehicle?.odometerKm || 0)} km is on the ${vehicle?.model ?? 'car'}'s record.`
            : `${currency} ${formatNumber(Number(amount) || 0)} is on the ${vehicle?.model ?? 'car'}'s record.`}
        </T>
        <T variant="lede">
          {vehicle ? `${vehicle.make} ${vehicle.model} · ${formatDateLong(todayIso())}` : formatDateLong(todayIso())}
        </T>
        <Footnote style={styles.note}>
          {isReading
            ? 'DISTANCE REMINDERS AND COST PER KM NOW MEASURE FROM THIS READING.'
            : 'IT COUNTS TOWARDS THIS YEAR’S SPEND AND THE CAR’S HISTORY. EDIT IT ANY TIME FROM THE TIMELINE.'}
        </Footnote>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: {
    paddingTop: 96,
    gap: Spacing.md,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: Spacing.sm,
  },
  disc: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.accent,
    borderWidth: 5,
    borderColor: Colors.accentSoft,
  },
  pill: {
    backgroundColor: Colors.accentSoft,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  note: {
    marginTop: Spacing.md,
  },
});
