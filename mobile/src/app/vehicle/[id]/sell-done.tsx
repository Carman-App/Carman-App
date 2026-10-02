import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Footnote } from '@/components/ui/Blocks';
import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { T } from '@/components/ui/Typography';
import { useVehicle } from '@/data/hooks';
import { Colors, FontFamily, Radius, Spacing } from '@/theme/tokens';

/** Handed over: the code the buyer redeems, and what the seller keeps. */
export default function SellDoneScreen() {
  const { id, model: modelParam, salePrice } = useLocalSearchParams<{ id: string; buyer?: string; model?: string; salePrice?: string }>();
  const vehicle = useVehicle(id).data;
  // The vehicle may already be gone (handover without a read-only copy deletes it), so fall back to the model carried in params.
  const model = vehicle?.model ?? modelParam ?? 'vehicle';
  const plate = (vehicle?.plate && vehicle.plate !== 'UNASSIGNED' ? vehicle.plate : 'CAR').replace(/\s/g, '').slice(0, 3).toUpperCase();
  const code = `CRM-${String(parseInt(id.replace(/\D/g, '').slice(-4) || '4417', 10)).padStart(4, '0')}-${plate}-${id.slice(-2).toUpperCase()}`;

  return (
    <Screen footer={<Button onPress={() => router.replace('/home')}>Back to my garage</Button>}>
      <View style={styles.body}>
        <View style={styles.badgeRow}>
          <View style={styles.disc} />
          <View style={styles.pill}>
            <T variant="eyebrowStrong" color={Colors.accent}>
              HANDED OVER
            </T>
          </View>
        </View>
        <T variant="display">
          The {model} and its history are with <T variant="display" style={{ textTransform: 'uppercase' }}>the buyer.</T>
        </T>
        <View style={styles.card}>
          <T variant="eyebrow" color={Colors.slate}>
            HANDOVER CODE
          </T>
          <T style={styles.code}>{code}</T>
          <T variant="eyebrow" color={Colors.slate}>
            SENT BY TEXT · EXPIRES IN 7 DAYS
          </T>
          <T variant="eyebrow" color={Colors.slate}>
            {salePrice ? 'SALE PRICE KEPT IN YOUR RECORDS' : 'SALE PRICE NOT RECORDED'}
          </T>
        </View>
        <Footnote>YOU KEEP A READ-ONLY COPY IF YOU CHOSE ONE. IT CANNOT BE EDITED AND IT STOPS COUNTING TOWARDS YOUR COSTS.</Footnote>
      </View>
    </Screen>
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
    gap: 8,
  },
  code: {
    fontFamily: FontFamily.medium,
    fontSize: 20,
    letterSpacing: 2,
    color: Colors.ink,
    marginVertical: 4,
  },
});
