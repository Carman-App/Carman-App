import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { QueryBoundary } from '@/components/data/QueryBoundary';
import { Footnote } from '@/components/ui/Blocks';
import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { T } from '@/components/ui/Typography';
import { TopBar } from '@/components/ui/TopBar';
import { useRecords, useVehicle } from '@/data/hooks';
import { TransferRow } from '@/features/transfer/TransferRow';
import { Spacing } from '@/theme/tokens';

/** Selling the car: what goes with it, what stays with you. */
export default function SellIntroScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const vehicleQuery = useVehicle(id);
  const records = useRecords(id).data ?? [];
  const service = records.filter((r) => r.type === 'service' || r.type === 'repair');
  const since = service.reduce<number | null>((m, r) => (m == null || Number(r.date.slice(0, 4)) < m ? Number(r.date.slice(0, 4)) : m), null);

  return (
    <Screen
      padded={false}
      header={<TopBar backLabel="DETAILS" right="TRANSFER" />}
      footer={
        <>
          <Footnote>THE TRANSFER CODE EXPIRES AFTER 7 DAYS. YOU CAN CANCEL IT ANY TIME BEFORE IT IS USED.</Footnote>
          <Button caps onPress={() => router.push(`/vehicle/${id}/sell-who`)}>
            Start the handover
          </Button>
        </>
      }>
      <QueryBoundary query={vehicleQuery} isEmpty={() => false}>
        {(v) => (
          <>
            <View style={styles.head}>
              <T variant="display">Selling the {v.model}?</T>
              <T variant="lede">
                Hand over the vehicle with its history intact. The buyer scans one code and every service, repair and part comes with the car. Your receipts, costs and documents stay with you.
              </T>
            </View>
            <TransferRow glyph="service" title="Service and repair history" sub={`${service.length} RECORDS${since ? ` · ${since} ONWARD` : ''}`} goes />
            <TransferRow glyph="part" title="Parts fitted" sub={`${records.filter((r) => r.type === 'part').length} RECORDS`} goes />
            <TransferRow glyph="odometer" title="Odometer readings" sub={`${records.filter((r) => r.odometerAtEntry > 0).length} READINGS`} goes />
            <TransferRow glyph="info" title="Vehicle details" sub="REGISTRATION · VIN · SPECIFICATION" goes />
            <TransferRow glyph="wallet" title="Your receipts and amounts" sub="WHAT YOU PAID STAYS PRIVATE" goes={false} />
            <TransferRow glyph="document" title="Insurance and licence documents" sub="IN YOUR NAME, NOT THE CAR’S" goes={false} />
          </>
        )}
      </QueryBoundary>
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.lg,
    gap: 12,
  },
});
