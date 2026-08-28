import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Switch, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ListRow } from '@/components/ui/ListRow';
import { ProgressSteps } from '@/components/ui/ProgressSteps';
import { Screen } from '@/components/ui/Screen';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { T } from '@/components/ui/Typography';
import { QueryBoundary } from '@/components/data/QueryBoundary';
import { useInspections, useRecords, useVehicle } from '@/data/hooks';
import { transferVehicle } from '@/data/repo';
import { Colors, Radius, Spacing } from '@/theme/tokens';

export default function SellWhatScreen() {
  const { id, buyer, phone, salePrice } = useLocalSearchParams<{
    id: string;
    buyer?: string;
    phone?: string;
    salePrice?: string;
  }>();
  const vehicleQuery = useVehicle(id);
  const records = useRecords(id).data ?? [];
  const inspections = useInspections(id).data ?? [];
  const [keepCopy, setKeepCopy] = useState(true);
  const [handing, setHanding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const serviceRepairCount = records.filter((r) => r.type === 'service' || r.type === 'repair').length;
  const odometerRecords = records.filter((r) => r.type === 'odometer');
  const odometerCount = odometerRecords.length;
  const odometerSinceYear = odometerRecords.reduce<number | null>((min, r) => {
    const y = Number(r.date.slice(0, 4));
    return min == null || y < min ? y : min;
  }, null);
  const partsCount = records.filter((r) => r.type === 'part').length;
  const inspectionWorkshop = inspections[0]?.workshopName;

  const handleHandover = async () => {
    setHanding(true);
    setError(null);
    try {
      if (!keepCopy) {
        await transferVehicle(id);
      }
      router.replace({
        pathname: `/vehicle/${id}/sell-done`,
        params: { buyer: buyer ?? '', phone: phone ?? '', salePrice: salePrice ?? '', model: vehicleQuery.data?.model ?? '' },
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Try again.');
    } finally {
      setHanding(false);
    }
  };

  return (
    <Screen
      scroll
      contentStyle={styles.content}
      footer={<Button loading={handing} onPress={handleHandover}>Hand over to buyer</Button>}>
      <ProgressSteps step={2} total={3} />
      <T variant="display" style={styles.title}>
        What goes with the car
      </T>

      <QueryBoundary query={vehicleQuery} isEmpty={() => false}>
        {() => (
          <>
            <SectionHeader title="TRANSFERS TO THE BUYER" />
            <Card padded={false} style={styles.card}>
              <ListRow title="Service and repair history" subtitle={`${serviceRepairCount} RECORDS · EVERY JOB AND LINE ITEM`} />
              <ListRow
                title="Odometer history"
                subtitle={`${odometerCount} CONFIRMED READINGS${odometerSinceYear ? ` SINCE ${odometerSinceYear}` : ''}`}
              />
              <ListRow title="Parts fitted" subtitle={`${partsCount} PARTS · BRAND AND DATE`} />
              <ListRow
                title="Inspection reports"
                subtitle={`${inspections.length} REPORTS${inspectionWorkshop ? ` FROM ${inspectionWorkshop.toUpperCase()}` : ''}`}
                bordered={false}
              />
            </Card>

            <SectionHeader title="STAYS WITH YOU" />
            <Card padded={false} style={styles.card}>
              <ListRow title="Fuel and running costs" subtitle="WHAT YOU PAID IS YOURS" />
              <ListRow title="Receipts and invoices" subtitle="YOUR FINANCIAL RECORD" />
              <ListRow title="Insurance and licence" subtitle="TIED TO YOU, NOT THE CAR" />
              <ListRow title="Garage members" subtitle="NOBODY IS CARRIED OVER" bordered={false} />
            </Card>

            <Pressable style={styles.toggleRow} onPress={() => setKeepCopy((v) => !v)}>
              <View style={styles.toggleText}>
                <T variant="bodyStrong">Keep a read-only copy of this vehicle in my garage</T>
                <T variant="meta" style={styles.toggleHelper}>
                  YOU KEEP A READ-ONLY COPY OF THE FULL HISTORY AFTER HANDOVER.
                </T>
              </View>
              <Switch value={keepCopy} onValueChange={setKeepCopy} trackColor={{ true: Colors.accent, false: Colors.border }} />
            </Pressable>

            {error ? (
              <T variant="body" color={Colors.danger} center style={styles.error}>
                {error}
              </T>
            ) : null}
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
    marginBottom: Spacing.lg,
  },
  card: {
    padding: Spacing.md,
    marginBottom: Spacing.lg,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.surfaceMuted,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
  },
  toggleText: {
    flex: 1,
    gap: 4,
  },
  toggleHelper: {
    marginTop: 2,
  },
  error: {
    marginBottom: Spacing.md,
  },
});
