import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { ModalHeader } from '@/components/ui/ModalHeader';
import { PickerField, PickerSheet } from '@/components/ui/PickerSheet';
import { Screen } from '@/components/ui/Screen';
import { TextField } from '@/components/ui/TextField';
import { T } from '@/components/ui/Typography';
import { useActiveGarageId } from '@/data/hooks';
import { addVehicle } from '@/data/repo';
import { makeTableFor, YEARS } from '@/data/vehicleCatalog';
import { todayIso } from '@/lib/format';
import { USAGE_LABEL, type VehicleType, type VehicleUsage } from '@/types/domain';
import { Colors, Radius, Spacing } from '@/theme/tokens';

type OpenPicker = 'make' | 'model' | 'year' | null;

/**
 * Standalone "add another vehicle" form -- distinct from the onboarding
 * wizard (which seeds/resets the whole demo account). Used from the empty
 * Garage state and from "Add a vehicle" in Garage View.
 */
export default function AddVehicleScreen() {
  const garageId = useActiveGarageId();
  const [type, setType] = useState<VehicleType>('car');
  const [usage, setUsage] = useState<VehicleUsage>('daily');
  const [rawMake, setRawMake] = useState('');
  const [rawModel, setRawModel] = useState('');
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [plate, setPlate] = useState('');
  const [odometerKm, setOdometerKm] = useState('0');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openPicker, setOpenPicker] = useState<OpenPicker>(null);

  const table = makeTableFor(type);
  // Nothing is picked for the person: empty until they choose or type one.
  const make = rawMake;
  const models = table[make] ?? [];
  const model = rawModel;

  const canSave = garageId && make.trim() && model.trim();

  const handlePickType = (t: VehicleType) => {
    setType(t);
    setRawMake('');
    setRawModel('');
  };
  const handlePickMake = (name: string) => {
    setRawMake(name);
    setRawModel(table[name][0]);
    setOpenPicker(null);
  };
  const handlePickModel = (name: string) => {
    setRawModel(name);
    setOpenPicker(null);
  };
  const handlePickYear = (name: string) => {
    setYear(name);
    setOpenPicker(null);
  };

  const handleSave = async () => {
    if (!garageId) return;
    setSaving(true);
    setError(null);
    try {
      const vehicle = await addVehicle({
        garageId,
        make,
        model,
        year: Number(year) || new Date().getFullYear(),
        type,
        usage,
        plate: plate.trim() ? plate.trim().toUpperCase() : undefined,
        odometerKm: Number(odometerKm) || 0,
        createdAt: todayIso(),
      });
      router.replace(`/vehicle/${vehicle.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen footer={<Button disabled={!canSave} loading={saving} onPress={handleSave}>Add vehicle</Button>}>
      <ModalHeader eyebrow="GARAGE" title="Add a vehicle" />
      <View style={styles.row}>
        {(['car', 'motorcycle'] as VehicleType[]).map((t) => (
          <Pressable key={t} onPress={() => handlePickType(t)} style={[styles.choice, type === t && styles.choiceActive]}>
            <T variant="bodyStrong" color={type === t ? Colors.accent : Colors.text}>
              {t === 'car' ? 'Car' : 'Motorcycle'}
            </T>
          </Pressable>
        ))}
      </View>
      <View style={styles.row}>
        {(['daily', 'project', 'weekend', 'commercial'] as VehicleUsage[]).map((u) => (
          <Pressable key={u} onPress={() => setUsage(u)} style={[styles.choiceSmall, usage === u && styles.choiceActive]}>
            <T variant="meta" color={usage === u ? Colors.accent : Colors.textMuted}>
              {USAGE_LABEL[u]}
            </T>
          </Pressable>
        ))}
      </View>
      <View style={styles.form}>
        <PickerField label="MAKE" value={make} onPress={() => setOpenPicker('make')} />
        <PickerField label="MODEL" value={model} onPress={() => setOpenPicker('model')} />
        <PickerField label="YEAR" value={year} onPress={() => setOpenPicker('year')} />
        <TextField label="PLATE" value={plate} onChangeText={(v) => setPlate(v.toUpperCase())} placeholder="KDG 441X" />
        <TextField label="ODOMETER" value={odometerKm} onChangeText={(v) => setOdometerKm(v.replace(/\D/g, ''))} keyboardType="number-pad" prefix="KM" />
      </View>

      {error ? (
        <T variant="body" color={Colors.danger} center style={styles.error}>
          {error}
        </T>
      ) : null}

      <PickerSheet
        visible={openPicker === 'make'}
        title="Select make"
        hint={type === 'motorcycle' ? 'MOTORCYCLE MAKES' : 'CAR MAKES'}
        items={Object.keys(table)}
        selected={make}
        onSelect={handlePickMake}
        onClose={() => setOpenPicker(null)}
        searchPlaceholder="Search or type a make"
        allowCustom
      />
      <PickerSheet
        visible={openPicker === 'model'}
        title="Select model"
        hint={make ? `${make.toUpperCase()} MODELS` : 'PICK A MAKE FIRST'}
        items={models}
        selected={model}
        onSelect={handlePickModel}
        onClose={() => setOpenPicker(null)}
        searchPlaceholder="Search or type a model"
        allowCustom
      />
      <PickerSheet
        visible={openPicker === 'year'}
        title="Select year"
        hint="MODEL YEAR"
        items={YEARS}
        selected={year}
        onSelect={handlePickYear}
        onClose={() => setOpenPicker(null)}
        searchPlaceholder="Jump to a year"
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  choice: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
  },
  choiceSmall: {
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: Radius.pill,
    paddingVertical: 6,
    paddingHorizontal: Spacing.sm,
  },
  choiceActive: {
    borderColor: Colors.accent,
    backgroundColor: Colors.accentSoft,
  },
  form: {
    gap: Spacing.md,
    marginTop: Spacing.md,
  },
  error: {
    marginTop: Spacing.md,
  },
});
