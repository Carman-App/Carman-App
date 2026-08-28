import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet } from 'react-native';

import { QueryBoundary } from '@/components/data/QueryBoundary';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { T } from '@/components/ui/Typography';
import { useEstimate, useVehicle } from '@/data/hooks';
import { formatMoney, todayIso } from '@/lib/format';
import type { Estimate } from '@/types/domain';
import { Colors, Spacing } from '@/theme/tokens';

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
          <Screen scroll contentStyle={styles.content}>
            <T variant="eyebrowStrong" color={Colors.positive}>
              APPROVED
            </T>
            <T variant="display" style={styles.title}>
              {formatMoney(estimate.total)}
            </T>
            <T variant="body" color={Colors.textMuted}>
              {summary} · {estimate.workshopName} · EST {estimate.id.toUpperCase()}
            </T>

            <Card style={styles.dropCard}>
              <T variant="eyebrow">DROP THE CAR OFF</T>
              <T variant="numeric">{formatDropOff(dropOff)}</T>
              <T variant="meta">IN 2 DAYS</T>
            </Card>

            <T variant="body" color={Colors.textMuted} style={styles.explainer}>
              {estimate.workshopName} sees this now. They invoice you after the work, and it joins your vehicle history.
            </T>

            <Button onPress={() => router.replace(`/vehicle/${estimate.vehicleId}`)}>
              Back to {vehicle ? vehicle.model.split(' ').pop() : 'vehicle'}
            </Button>
          </Screen>
        );
      }}
    </QueryBoundary>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: Spacing.xxl,
  },
  title: {
    marginTop: Spacing.xs,
  },
  dropCard: {
    marginTop: Spacing.xl,
    marginBottom: Spacing.lg,
    gap: 2,
  },
  explainer: {
    marginBottom: Spacing.xl,
  },
});
