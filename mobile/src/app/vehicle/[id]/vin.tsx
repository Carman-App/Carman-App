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

export default function VehicleVinScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const vehicle = useVehicle(id).data;
  const [vin, setVin] = useState(vehicle?.vin ?? '');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!id || !vin.trim()) return;
    setSaving(true);
    await updateVehicle(id, { vin: vin.trim() });
    setSaving(false);
    router.back();
  };

  return (
    <Screen
      footer={
        <View style={styles.footer}>
          <Button onPress={save} loading={saving} disabled={!vin.trim()}>
            Save VIN
          </Button>
          <Button variant="ghost" onPress={() => router.back()}>
            I&apos;ll do this later
          </Button>
        </View>
      }>
      <T variant="eyebrow">OPTIONAL</T>
      <T variant="display" style={styles.title}>
        Add your VIN
      </T>
      <T variant="body" color={Colors.textMuted} style={styles.intro}>
        Your VIN tells Carma exactly which vehicle you own: down to the engine.
      </T>

      <View style={styles.bullets}>
        <T variant="body" color={Colors.textMuted} style={styles.bullet}>
          • Confirms exact specification
        </T>
        <T variant="body" color={Colors.textMuted} style={styles.bullet}>
          • Identifies compatible parts
        </T>
        <T variant="body" color={Colors.textMuted} style={styles.bullet}>
          • Surfaces manufacturer recalls
        </T>
        <T variant="body" color={Colors.textMuted} style={styles.bullet}>
          • Builds a verifiable history
        </T>
      </View>

      <TextField label="VIN PLATE / DOOR JAMB" value={vin} onChangeText={setVin} placeholder="e.g. JTEBU29J...." autoFocus />
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
  bullets: {
    gap: Spacing.xs,
    marginBottom: Spacing.xl,
  },
  bullet: {},
  footer: {
    gap: Spacing.xs,
  },
});
