import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Footnote, ScreenTitle } from '@/components/ui/Blocks';
import { Button } from '@/components/ui/Button';
import { ChoiceRow } from '@/components/ui/ChoiceRow';
import { Screen } from '@/components/ui/Screen';
import { TopBar } from '@/components/ui/TopBar';
import { useVehicle } from '@/data/hooks';
import { updateVehicle } from '@/data/repo';
import type { Powertrain } from '@/types/domain';
import { Spacing } from '@/theme/tokens';

const POWERTRAINS: { key: Powertrain; label: string; sub: string; glyph: string }[] = [
  { key: 'petrol', label: 'Petrol', sub: 'FUEL RECORDS · LITRES', glyph: 'fuel' },
  { key: 'diesel', label: 'Diesel', sub: 'FUEL RECORDS · LITRES', glyph: 'fuel' },
  { key: 'hybrid', label: 'Hybrid', sub: 'FUEL · LITRES', glyph: 'fuel' },
  { key: 'electric', label: 'Electric', sub: 'CHARGING · KWH', glyph: 'odometer' },
];

/** What powers the vehicle: decides whether records ask for litres or kWh. */
export default function VehiclePowertrainScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const vehicle = useVehicle(id).data;
  const [powertrain, setPowertrain] = useState<Powertrain | undefined>(vehicle?.powertrain);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!id || !powertrain) return;
    setSaving(true);
    await updateVehicle(id, { powertrain });
    setSaving(false);
    router.back();
  };

  return (
    <Screen
      padded={false}
      header={<TopBar backLabel="DETAILS" right="OPTIONAL" />}
      footer={
        <Button onPress={save} loading={saving} disabled={!powertrain}>
          {powertrain ? 'Save' : 'Pick one'}
        </Button>
      }>
      <View style={styles.inset}>
        <ScreenTitle title={`What powers the ${vehicle?.model ?? 'vehicle'}?`} lede="Carma asks for litres or kilowatt-hours to match." />
      </View>
      {POWERTRAINS.map((p) => (
        <ChoiceRow key={p.key} glyph={p.glyph} title={p.label} sub={p.sub} subCaps selected={powertrain === p.key} onPress={() => setPowertrain(p.key)} />
      ))}
      <View style={styles.inset}>
        <Footnote>CHANGING THIS DOES NOT ALTER RECORDS YOU HAVE ALREADY SAVED.</Footnote>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  inset: {
    paddingHorizontal: Spacing.lg,
  },
});
