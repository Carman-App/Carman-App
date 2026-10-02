import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Rule, ScreenTitle } from '@/components/ui/Blocks';
import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { TextField } from '@/components/ui/TextField';
import { T } from '@/components/ui/Typography';
import { TopBar } from '@/components/ui/TopBar';
import { useVehicle } from '@/data/hooks';
import { updateVehicle } from '@/data/repo';
import { Colors, Spacing } from '@/theme/tokens';

const WHY = ['Confirms exact specification', 'Identifies compatible parts', 'Surfaces manufacturer recalls', 'Builds a verifiable history'];

/** VIN, added later from Vehicle details. 17 characters from the door jamb plate. */
export default function VehicleVinScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const vehicle = useVehicle(id).data;
  const [vin, setVin] = useState(vehicle?.vin ?? '');
  const [saving, setSaving] = useState(false);
  const clean = vin.replace(/[^A-HJ-NPR-Z0-9]/gi, '').toUpperCase();
  const valid = clean.length === 17;

  const save = async () => {
    if (!id || !valid) return;
    setSaving(true);
    await updateVehicle(id, { vin: clean });
    setSaving(false);
    router.back();
  };

  return (
    <Screen
      header={<TopBar backLabel="DETAILS" right="OPTIONAL" />}
      footer={
        <>
          <Button onPress={save} loading={saving} disabled={!valid}>
            {valid ? 'Save VIN' : `${clean.length} of 17 characters`}
          </Button>
          <Button variant="secondary" size="md" onPress={() => router.back()}>
            Not now
          </Button>
        </>
      }>
      <ScreenTitle title="Add your VIN" lede={`Your VIN tells Carma exactly which ${vehicle?.model ?? 'vehicle'} you own, down to the engine.`} />
      {WHY.map((w) => (
        <View key={w} style={styles.why}>
          <View style={styles.square} />
          <T variant="body" color={Colors.ink}>
            {w}
          </T>
        </View>
      ))}
      <Rule />
      <View style={styles.field}>
        <TextField
          label="VIN"
          value={vin}
          onChangeText={(v) => setVin(v.toUpperCase())}
          placeholder="17 characters"
          autoCapitalize="characters"
          helper="On the plate inside the driver’s door, at the base of the windscreen, or on the logbook."
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  why: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.line,
  },
  square: {
    width: 6,
    height: 6,
    backgroundColor: Colors.accent,
  },
  field: {
    paddingVertical: Spacing.lg,
  },
});
