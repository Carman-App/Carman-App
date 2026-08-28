import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { IconGlyph } from '@/components/ui/IconGlyph';
import { ListRow } from '@/components/ui/ListRow';
import { Screen } from '@/components/ui/Screen';
import { T } from '@/components/ui/Typography';
import { useVehicle } from '@/data/hooks';
import { useOnboardingDraft } from '@/features/onboarding/context';
import { USAGE_LABEL } from '@/types/domain';
import { formatNumber } from '@/lib/format';
import { Colors, Radius, Spacing } from '@/theme/tokens';

export default function VehicleAddedScreen() {
  const { draft } = useOnboardingDraft();
  const vehicle = useVehicle(draft.vehicleId).data;

  const goHome = () => router.replace('/garage');

  return (
    <Screen footer={<Button onPress={goHome}>Go to My Garage</Button>}>
      <View style={styles.header}>
        <T variant="eyebrow">VEHICLE ADDED</T>
        <T variant="display">
          {draft.model} is in your Garage
        </T>
      </View>

      <View style={styles.photo}>
        <IconGlyph glyph={draft.vehicleType === 'car' ? 'vehicle' : 'motorcycle'} size={64} />
        <T variant="meta" style={styles.addPhoto}>
          ADD PHOTO
        </T>
      </View>

      <View style={styles.summaryCard}>
        <T variant="bodyStrong">
          {draft.make} {draft.model} · {draft.year} · {USAGE_LABEL[draft.usage]}
        </T>
        <T variant="meta">
          {formatNumber(vehicle?.odometerKm ?? draft.odometerKm)} KM · Kenya
        </T>
      </View>

      <View style={styles.section}>
        <T variant="eyebrow">COMPLETE THE RECORD · 2 LEFT</T>
        <ListRow title="VIN" meta="NOT YET ADDED" onPress={() => vehicle && router.push(`/vehicle/${vehicle.id}/vin`)} />
        <ListRow title="Powertrain" meta="NOT YET ADDED" bordered={false} onPress={() => vehicle && router.push(`/vehicle/${vehicle.id}/powertrain`)} />
        <T variant="meta" style={styles.footnote}>
          NOT NEEDED TO START LOGGING. WORTH ADDING BEFORE YOU SELL: A BUYER CAN CHECK THE VIN AGAINST THE HISTORY.
        </T>
      </View>

      <View style={styles.section}>
        <T variant="eyebrow">START THE HISTORY</T>
        <ListRow title="Add fuel" onPress={() => vehicle && router.push({ pathname: '/record/fuel', params: { vehicleId: vehicle.id } })} />
        <ListRow title="Add a service record" onPress={() => vehicle && router.push({ pathname: '/record/service', params: { vehicleId: vehicle.id } })} />
        <ListRow
          title="Add insurance document"
          bordered={false}
          onPress={() => vehicle && router.push({ pathname: '/doc/scan', params: { vehicleId: vehicle.id } })}
        />
      </View>

      <T variant="meta" center style={styles.trial}>
        5 DAYS LEFT IN YOUR TRIAL
      </T>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: Spacing.xs,
    marginTop: Spacing.sm,
  },
  photo: {
    alignItems: 'center',
    gap: Spacing.xs,
    marginVertical: Spacing.lg,
  },
  addPhoto: {
    letterSpacing: 1,
  },
  summaryCard: {
    backgroundColor: Colors.surfaceMuted,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    gap: 4,
    marginBottom: Spacing.lg,
  },
  section: {
    marginBottom: Spacing.lg,
    gap: Spacing.xxs,
  },
  footnote: {
    marginTop: Spacing.xs,
  },
  trial: {
    marginTop: Spacing.sm,
  },
});
