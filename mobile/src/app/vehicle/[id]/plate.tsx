import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { Footnote, ScreenTitle } from '@/components/ui/Blocks';
import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { T } from '@/components/ui/Typography';
import { TopBar } from '@/components/ui/TopBar';
import { useVehicle } from '@/data/hooks';
import { updateVehicle } from '@/data/repo';
import { Colors, FontFamily, Radius, Spacing } from '@/theme/tokens';

/**
 * Registration isn't collected during onboarding; it's added later here,
 * from Vehicle details, the same deferred pattern as VIN and Powertrain.
 */
export default function VehiclePlateScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const vehicle = useVehicle(id).data;
  // 'UNASSIGNED' is the placeholder sent when no real plate was set yet (see @/data/repo).
  const [plate, setPlate] = useState(vehicle?.plate && vehicle.plate !== 'UNASSIGNED' ? vehicle.plate : '');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!id || !plate.trim()) return;
    setSaving(true);
    await updateVehicle(id, { plate: plate.trim().toUpperCase() });
    setSaving(false);
    router.back();
  };

  return (
    <Screen
      header={<TopBar backLabel="DETAILS" right="OPTIONAL" />}
      footer={
        <>
          <Button onPress={save} loading={saving} disabled={!plate.trim()}>
            Save registration
          </Button>
          <Button variant="secondary" size="md" onPress={() => router.back()}>
            Not now
          </Button>
        </>
      }>
      <ScreenTitle
        title="Add your registration"
        lede="Not needed to start logging. Worth adding before you sell, share access with a mechanic, or export a report."
      />
      <View style={styles.plate}>
        <T variant="eyebrow" color={Colors.slate}>
          {vehicle ? `${vehicle.make} ${vehicle.model}`.toUpperCase() : 'PLATE'}
        </T>
        <TextInput
          value={plate}
          onChangeText={(v) => setPlate(v.toUpperCase())}
          placeholder="KDG 441X"
          placeholderTextColor={Colors.textFaint}
          autoCapitalize="characters"
          autoFocus
          style={styles.plateInput}
        />
      </View>
      <Footnote>SHOWN ON THE VEHICLE, ITS QR PAGE AND REPORTS. ONLY YOUR GARAGE AND MECHANICS YOU APPROVE SEE IT.</Footnote>
    </Screen>
  );
}

const styles = StyleSheet.create({
  plate: {
    marginTop: Spacing.md,
    marginBottom: Spacing.lg,
    alignSelf: 'center',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderWidth: 2,
    borderColor: Colors.ink,
    borderRadius: Radius.sm,
    backgroundColor: Colors.ctaSoft,
    minWidth: 240,
  },
  plateInput: {
    outlineWidth: 0,
    fontFamily: FontFamily.bold,
    fontSize: 34,
    letterSpacing: 3,
    color: Colors.ink,
    textAlign: 'center',
    minWidth: 200,
  },
});
