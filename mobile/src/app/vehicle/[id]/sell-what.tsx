import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Toggle } from '@/components/ui/Blocks';
import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { T } from '@/components/ui/Typography';
import { TopBar } from '@/components/ui/TopBar';
import { useRecords, useVehicle } from '@/data/hooks';
import { transferVehicle } from '@/data/repo';
import { TransferRow } from '@/features/transfer/TransferRow';
import { Colors, Spacing } from '@/theme/tokens';

/** What goes with the car, what stays with you, then the hand-over itself. */
export default function SellWhatScreen() {
  const { id, buyer, phone, salePrice } = useLocalSearchParams<{ id: string; buyer?: string; phone?: string; salePrice?: string }>();
  const vehicle = useVehicle(id).data;
  const records = useRecords(id).data ?? [];
  const [keepCopy, setKeepCopy] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const service = records.filter((r) => r.type === 'service' || r.type === 'repair').length;

  const handOver = async () => {
    setBusy(true);
    setError(null);
    try {
      if (!keepCopy) await transferVehicle(id);
      router.replace({ pathname: `/vehicle/${id}/sell-done`, params: { buyer: buyer ?? '', phone: phone ?? '', salePrice: salePrice ?? '', model: vehicle?.model ?? '' } });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Try again.');
      setBusy(false);
    }
  };

  return (
    <Screen
      padded={false}
      header={<TopBar backLabel="BUYER" step={{ step: 2, total: 3 }} />}
      footer={
        <>
          {error ? (
            <T variant="meta" color={Colors.danger} center>
              {error}
            </T>
          ) : null}
          <Button variant="strong" caps loading={busy} onPress={handOver}>
            Hand over to the buyer
          </Button>
        </>
      }>
      <View style={styles.head}>
        <T variant="display">What goes with the car</T>
      </View>
      <T variant="eyebrow" color={Colors.accent} style={styles.group}>
        TRANSFERS TO {buyer ? buyer.toUpperCase() : 'THE BUYER'}
      </T>
      <TransferRow glyph="service" title="Service and repair history" sub={`${service} RECORDS`} goes tag={false} />
      <TransferRow glyph="part" title="Parts fitted" sub={`${records.filter((r) => r.type === 'part').length} RECORDS`} goes tag={false} />
      <TransferRow glyph="odometer" title="Odometer readings" sub={`${records.filter((r) => r.odometerAtEntry > 0).length} READINGS`} goes tag={false} />
      <TransferRow glyph="info" title="Vehicle details" sub="REGISTRATION · VIN · SPECIFICATION" goes tag={false} />
      <T variant="eyebrow" color={Colors.slate} style={styles.group}>
        STAYS WITH YOU
      </T>
      <TransferRow glyph="wallet" title="Your receipts and amounts" sub="WHAT YOU PAID STAYS PRIVATE" goes={false} tag={false} />
      <TransferRow glyph="document" title="Insurance and licence documents" sub="IN YOUR NAME, NOT THE CAR’S" goes={false} tag={false} />
      <TransferRow glyph="fuel" title="Fuel and running costs" sub="COST PER KM STAYS WITH YOU" goes={false} tag={false} />
      <TransferRow glyph="reminder" title="Reminders you set" sub="CLEARED FROM YOUR GARAGE" goes={false} tag={false} />
      <View style={styles.keep}>
        <View style={styles.flex}>
          <T variant="bodyStrong">Keep a read-only copy</T>
          <T variant="meta">It cannot be edited and stops counting towards your costs.</T>
        </View>
        <Toggle value={keepCopy} onValueChange={setKeepCopy} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.lg,
  },
  group: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.line,
  },
  keep: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.line,
  },
  flex: {
    flex: 1,
    gap: 4,
  },
});
