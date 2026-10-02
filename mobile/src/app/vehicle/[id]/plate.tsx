import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { TextField } from '@/components/ui/TextField';
import { T } from '@/components/ui/Typography';
import { updateVehicle } from '@/data/repo';
import { useVehicle } from '@/data/hooks';
import { Colors, Spacing } from '@/theme/tokens';

/**
 * Registration/plate isn't collected during onboarding (prototype screen 07
 * has no plate field) — it's added later here, from Vehicle Details, the
 * same "deferred" pattern as VIN and Powertrain.
 */
export default function VehiclePlateScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const vehicle = useVehicle(id).data;
  // 'UNASSIGNED' is the placeholder onboarding/addVehicle sends when no real
  // plate was set yet (see @/data/repo) — don't prefill it as if it were a
  // real value the user typed.
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
      footer={
        <View style={styles.footer}>
          <Button onPress={save} loading={saving} disabled={!plate.trim()}>
            Save registration
          </Button>
          <Button variant="ghost" onPress={() => router.back()}>
            I&apos;ll do this later
          </Button>
        </View>
      }>
      <T variant="eyebrow">OPTIONAL</T>
      <T variant="display" style={styles.title}>
        Add your registration
      </T>
      <T variant="body" color={Colors.textMuted} style={styles.intro}>
        Not needed to start logging. Worth adding before you sell, share access with a mechanic, or generate a report.
      </T>

      <TextField
        label="PLATE"
        value={plate}
        onChangeText={(v) => setPlate(v.toUpperCase())}
        placeholder="KDG 441X"
        autoFocus
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    marginTop: Spacing.xxs,
    marginBottom: Spacing.xs,
  },
  intro: {
    marginBottom: Spacing.md,
  },
  footer: {
    gap: Spacing.xs,
  },
});
