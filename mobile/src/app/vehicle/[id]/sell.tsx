import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ListRow } from '@/components/ui/ListRow';
import { Screen } from '@/components/ui/Screen';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { T } from '@/components/ui/Typography';
import { QueryBoundary } from '@/components/data/QueryBoundary';
import { useRecords, useVehicle } from '@/data/hooks';
import { Colors, Radius, Spacing } from '@/theme/tokens';

function StatusTag({ label, goes }: { label: string; goes: boolean }) {
  return (
    <View style={[styles.tag, { backgroundColor: goes ? Colors.positiveSoft : Colors.surfaceMuted }]}>
      <T variant="eyebrow" color={goes ? Colors.positive : Colors.textMuted}>
        {label}
      </T>
    </View>
  );
}

export default function SellVehicleIntroScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const vehicleQuery = useVehicle(id);
  const records = useRecords(id).data ?? [];

  const serviceRepairRecords = records.filter((r) => r.type === 'service' || r.type === 'repair');
  const serviceRepairCount = serviceRepairRecords.length;
  const earliestYear = serviceRepairRecords.reduce<number | null>((min, r) => {
    const y = Number(r.date.slice(0, 4));
    return min == null || y < min ? y : min;
  }, null);
  const partsCount = records.filter((r) => r.type === 'part').length;
  const odometerCount = records.filter((r) => r.type === 'odometer').length;

  return (
    <Screen
      scroll
      contentStyle={styles.content}
      footer={
        <Button onPress={() => router.push(`/vehicle/${id}/sell-who`)}>Start the handover</Button>
      }>
      <Pressable onPress={() => router.back()}>
        <T variant="eyebrowStrong" color={Colors.accent}>
          ← BACK
        </T>
      </Pressable>

      <QueryBoundary query={vehicleQuery} isEmpty={() => false}>
        {(vehicle) => (
          <>
            <T variant="display" style={styles.title}>
              Selling the {vehicle.model}?
            </T>
            <T variant="body" color={Colors.textMuted} style={styles.body}>
              Hand over the vehicle with its history intact. The buyer scans one code and every service, repair and part
              comes with the car. Your receipts, costs and documents stay with you.
            </T>

            <SectionHeader title="GOES WITH THE VEHICLE" />
            <Card padded={false} style={styles.card}>
              <ListRow
                title="Service and repair history"
                subtitle={`${serviceRepairCount} RECORDS${earliestYear ? ` · ${earliestYear} ONWARD` : ''}`}
                right={<StatusTag label="GOES" goes />}
              />
              <ListRow title="Parts fitted" subtitle={`${partsCount} RECORDS`} right={<StatusTag label="GOES" goes />} />
              <ListRow
                title="Odometer readings"
                subtitle={`${odometerCount} READINGS`}
                bordered={false}
                right={<StatusTag label="GOES" goes />}
              />
            </Card>

            <SectionHeader title="STAYS WITH YOU" />
            <Card padded={false} style={styles.card}>
              <ListRow title="What you paid" subtitle="FUEL · PARKING · INSURANCE · FINES" right={<StatusTag label="STAYS" goes={false} />} />
              <ListRow
                title="Your documents"
                subtitle="INSURANCE · LICENCE · RECEIPTS"
                bordered={false}
                right={<StatusTag label="STAYS" goes={false} />}
              />
            </Card>

            <T variant="meta" style={styles.footnote}>
              THE TRANSFER CODE EXPIRES AFTER 7 DAYS. YOU CAN CANCEL IT ANY TIME BEFORE IT IS USED.
            </T>
          </>
        )}
      </QueryBoundary>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: Spacing.sm,
  },
  title: {
    marginTop: Spacing.md,
  },
  body: {
    marginTop: Spacing.xs,
    marginBottom: Spacing.lg,
  },
  card: {
    padding: Spacing.md,
    marginBottom: Spacing.lg,
  },
  tag: {
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
  },
  footnote: {
    marginBottom: Spacing.lg,
  },
});
