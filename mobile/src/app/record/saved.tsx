import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { IconGlyph } from '@/components/ui/IconGlyph';
import { ModalHeader } from '@/components/ui/ModalHeader';
import { Screen } from '@/components/ui/Screen';
import { T } from '@/components/ui/Typography';
import { useVehicle } from '@/data/hooks';
import { formatDateLong, formatMoney, todayIso } from '@/lib/format';
import { Colors, Spacing } from '@/theme/tokens';

export default function RecordSavedScreen() {
  const { vehicleId, amount } = useLocalSearchParams<{ vehicleId?: string; amount?: string; kind?: string }>();
  const vehicle = useVehicle(vehicleId).data;

  const done = () => router.replace(vehicleId ? `/vehicle/${vehicleId}` : '/garage');

  return (
    <Screen
      footer={
        <View style={styles.footer}>
          <Button variant="secondary" onPress={() => router.replace(vehicleId ? `/vehicle/${vehicleId}/timeline` : '/garage')}>
            See it on the timeline
          </Button>
          <Button variant="ghost" onPress={() => router.replace({ pathname: '/record/add', params: { vehicleId } })}>
            Add another record
          </Button>
          <Button onPress={done}>Done</Button>
        </View>
      }>
      <ModalHeader eyebrow="RECORD SAVED" onClose={done} closeLabel="DONE" />
      <View style={styles.center}>
        <IconGlyph glyph="check" size={88} bg={Colors.positiveSoft} fg={Colors.positive} />
        <T variant="eyebrowStrong" color={Colors.positive} style={styles.saved}>
          SAVED
        </T>
        <T variant="numericLarge">{formatMoney(Number(amount) || 0)}</T>
        {vehicle ? (
          <T variant="body" color={Colors.textMuted}>
            Added to {vehicle.make} {vehicle.model} · {formatDateLong(todayIso())}
          </T>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.xxl,
  },
  saved: {
    marginTop: Spacing.md,
  },
  footer: {
    gap: Spacing.sm,
  },
});
