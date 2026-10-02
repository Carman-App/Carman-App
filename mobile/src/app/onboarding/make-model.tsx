import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { PickerField, PickerSheet } from '@/components/ui/PickerSheet';
import { ProgressSteps } from '@/components/ui/ProgressSteps';
import { Screen } from '@/components/ui/Screen';
import { TextField } from '@/components/ui/TextField';
import { T } from '@/components/ui/Typography';
import { makeTableFor, resolveMake, resolveModel, YEARS } from '@/data/vehicleCatalog';
import { useOnboardingDraft } from '@/features/onboarding/context';
import { Colors, Spacing } from '@/theme/tokens';

type OpenPicker = 'make' | 'model' | 'year' | null;

export default function MakeModelScreen() {
  const { draft, update } = useOnboardingDraft();
  const [openPicker, setOpenPicker] = useState<OpenPicker>(null);

  const table = makeTableFor(draft.vehicleType);
  const make = resolveMake(table, draft.make);
  const models = table[make];
  const model = resolveModel(models, draft.model);
  const popular = models.slice(0, 4);

  const canContinue = make.trim() && model.trim();

  const handlePickMake = (name: string) => {
    update({ make: name, model: table[name][0] });
    setOpenPicker(null);
  };
  const handlePickModel = (name: string) => {
    update({ model: name });
    setOpenPicker(null);
  };
  const handlePickYear = (name: string) => {
    update({ year: Number(name) || draft.year });
    setOpenPicker(null);
  };

  return (
    <Screen footer={<Button disabled={!canContinue} onPress={() => router.push('/onboarding/odometer')}>Continue</Button>}>
      <ProgressSteps step={6} total={7} />
      <T variant="display">Which vehicle?</T>
      <View style={styles.form}>
        <PickerField label="MAKE" value={make} onPress={() => setOpenPicker('make')} />
        <PickerField label="MODEL" value={model} onPress={() => setOpenPicker('model')} />
        <PickerField label="YEAR" value={String(draft.year)} onPress={() => setOpenPicker('year')} />
        <TextField
          label="VARIANT"
          value={draft.variant}
          onChangeText={(v) => update({ variant: v })}
          placeholder="TX-L · optional"
        />
      </View>
      <View style={styles.popular}>
        <T variant="eyebrow">POPULAR · {make.toUpperCase()}</T>
        {popular.map((m) => (
          <View key={m} style={styles.popRow}>
            <T variant="body">
              {make} {m}
            </T>
            <T variant="eyebrowStrong" color={Colors.accent} onPress={() => update({ model: m })}>
              SELECT
            </T>
          </View>
        ))}
      </View>

      <PickerSheet
        visible={openPicker === 'make'}
        title="Select make"
        hint={draft.vehicleType === 'motorcycle' ? 'MOTORCYCLE MAKES' : 'CAR MAKES'}
        items={Object.keys(table)}
        selected={make}
        onSelect={handlePickMake}
        onClose={() => setOpenPicker(null)}
      />
      <PickerSheet
        visible={openPicker === 'model'}
        title="Select model"
        hint={`${make.toUpperCase()} MODELS`}
        items={models}
        selected={model}
        onSelect={handlePickModel}
        onClose={() => setOpenPicker(null)}
      />
      <PickerSheet
        visible={openPicker === 'year'}
        title="Select year"
        hint="MODEL YEAR"
        items={YEARS}
        selected={String(draft.year)}
        onSelect={handlePickYear}
        onClose={() => setOpenPicker(null)}
        searchPlaceholder="Jump to a year"
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: Spacing.md,
    marginTop: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  popular: {
    gap: Spacing.sm,
  },
  popRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderLight,
  },
});
