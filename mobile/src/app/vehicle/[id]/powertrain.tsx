import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { T } from '@/components/ui/Typography';
import { updateVehicle } from '@/data/repo';
import { useVehicle } from '@/data/hooks';
import type { Powertrain } from '@/types/domain';
import { Colors, Radius, Spacing } from '@/theme/tokens';

const POWERTRAINS: { key: Powertrain | 'other'; label: string; sub: string }[] = [
  { key: 'diesel', label: 'Diesel', sub: 'FUEL RECORDS' },
  { key: 'petrol', label: 'Petrol', sub: 'FUEL RECORDS' },
  { key: 'electric', label: 'Electric', sub: 'CHARGING · KWH' },
  { key: 'hybrid', label: 'Hybrid', sub: 'FUEL' },
  { key: 'other', label: 'Other', sub: '-' },
];

type Transmission = 'manual' | 'automatic';

export default function VehiclePowertrainScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const vehicle = useVehicle(id).data;
  const [powertrain, setPowertrain] = useState<Powertrain | 'other' | undefined>(vehicle?.powertrain);
  const [transmission, setTransmission] = useState<Transmission | undefined>(undefined);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!id) return;
    setSaving(true);
    if (powertrain && powertrain !== 'other') {
      await updateVehicle(id, { powertrain });
    }
    setSaving(false);
    router.back();
  };

  return (
    <Screen
      footer={
        <Button onPress={save} loading={saving} disabled={!powertrain}>
          Continue
        </Button>
      }>
      <T variant="eyebrow">OPTIONAL</T>
      <T variant="display" style={styles.title}>
        What powers your vehicle?
      </T>

      <View style={styles.list}>
        {POWERTRAINS.map((p) => (
          <Pressable
            key={p.key}
            style={[styles.option, powertrain === p.key && styles.optionSelected]}
            onPress={() => setPowertrain(p.key)}>
            <View style={styles.optionText}>
              <T variant="bodyStrong">{p.label}</T>
              <T variant="meta">{p.sub}</T>
            </View>
            {powertrain === p.key ? <T color={Colors.accent}>✓</T> : null}
          </Pressable>
        ))}
      </View>

      <T variant="eyebrow" style={styles.sectionTitle}>
        TRANSMISSION
      </T>
      <View style={styles.transRow}>
        <Pressable
          style={[styles.transOption, transmission === 'manual' && styles.optionSelected]}
          onPress={() => setTransmission('manual')}>
          <T variant="bodyStrong" center>
            Manual
          </T>
          <T variant="meta" center>
            STICK SHIFT
          </T>
        </Pressable>
        <Pressable
          style={[styles.transOption, transmission === 'automatic' && styles.optionSelected]}
          onPress={() => setTransmission('automatic')}>
          <T variant="bodyStrong" center>
            Automatic
          </T>
          <T variant="meta" center>
            TORQUE CONVERTER · CVT · DCT
          </T>
        </Pressable>
      </View>

      <T variant="meta" style={styles.footnote}>
        POWER DECIDES WHETHER CARMA ASKS FOR LITRES OR KILOWATT-HOURS. TRANSMISSION DECIDES WHICH SERVICE INTERVALS APPLY.
      </T>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    marginTop: Spacing.xxs,
    marginBottom: Spacing.lg,
  },
  list: {
    gap: Spacing.xs,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
    padding: Spacing.md,
  },
  optionSelected: {
    borderColor: Colors.accent,
    backgroundColor: Colors.accentSoft,
  },
  optionText: {
    gap: 2,
  },
  sectionTitle: {
    marginTop: Spacing.xl,
    marginBottom: Spacing.xs,
  },
  transRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  transOption: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
    paddingVertical: Spacing.md,
    gap: 2,
  },
  footnote: {
    marginTop: Spacing.lg,
  },
});
