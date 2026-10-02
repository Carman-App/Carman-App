import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { QueryBoundary } from '@/components/data/QueryBoundary';
import { Button } from '@/components/ui/Button';
import { Footnote } from '@/components/ui/Blocks';
import { Screen } from '@/components/ui/Screen';
import { T } from '@/components/ui/Typography';
import { useEstimate, useVehicle } from '@/data/hooks';
import { formatMoney, todayIso } from '@/lib/format';
import type { Estimate } from '@/types/domain';
import { Colors, Radius, Spacing } from '@/theme/tokens';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function addDays(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDropOff(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return `${WEEKDAYS[d.getDay()]} ${d.getDate()} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`;
}

export default function EstimateApprovedScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const estimateQuery = useEstimate(id);
  const { data: vehicle } = useVehicle(estimateQuery.data?.vehicleId);

  return (
    <QueryBoundary query={estimateQuery} isEmpty={() => false}>
      {(estimate: Estimate) => {
        const dropOff = addDays(todayIso(), 2);
        const summary = estimate.notes ?? estimate.lines[0]?.description ?? 'Work';
        return (
          <Screen
            footer={
              <>
                <Button onPress={() => router.replace('/home')}>Back to Home</Button>
                <Button variant="ghost" size="md" onPress={() => router.replace(`/vehicle/${estimate.vehicleId}`)}>
                  Open the {vehicle ? vehicle.model : 'vehicle'}
                </Button>
              </>
            }>
            <View style={styles.body}>
              <View style={styles.badgeRow}>
                <View style={styles.disc} />
                <View style={styles.pill}>
                  <T variant="eyebrowStrong" color={Colors.accent}>
                    AUTHORISED
                  </T>
                </View>
              </View>
              <T variant="display">{estimate.workshopName} can go ahead.</T>
              <T variant="lede">
                {summary} · {formatMoney(estimate.total)}
              </T>
              <View style={styles.card}>
                <T variant="eyebrow" color={Colors.slate}>
                  DROP THE CAR OFF
                </T>
                <T variant="numeric">{formatDropOff(dropOff)}</T>
                <T variant="eyebrow" color={Colors.slate}>
                  IN 2 DAYS
                </T>
              </View>
              <Footnote>{`${estimate.workshopName.toUpperCase()} SEES THIS NOW. THEY INVOICE YOU AFTER THE WORK, AND IT JOINS YOUR VEHICLE HISTORY.`}</Footnote>
            </View>
          </Screen>
        );
      }}
    </QueryBoundary>
  );
}

const styles = StyleSheet.create({
  body: {
    paddingTop: 72,
    gap: Spacing.lg,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
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
  card: {
    borderWidth: 1,
    borderColor: Colors.line,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    gap: 6,
  },
});
