import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { IconGlyph } from '@/components/ui/IconGlyph';
import { PickerSheet } from '@/components/ui/PickerSheet';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { FieldInput, FieldRow } from '@/components/ui/TextField';
import { makeTableFor, YEARS } from '@/data/vehicleCatalog';
import { useOnboardingDraft } from '@/features/onboarding/context';
import { OnboardingScreen } from '@/features/onboarding/OnboardingScreen';
import { Colors, Spacing } from '@/theme/tokens';
import type { Powertrain, Transmission } from '@/types/domain';

// Design (screen "Make and model"): POWERS with CHIP_ICON, TRANS per vehicle type.
const POWERTRAINS: { key: Powertrain; label: string; glyph: string }[] = [
  { key: 'diesel', label: 'Diesel', glyph: 'fuel' },
  { key: 'petrol', label: 'Petrol', glyph: 'fuel' },
  { key: 'electric', label: 'Electric', glyph: 'charging' },
  { key: 'hybrid', label: 'Hybrid', glyph: 'fuel' },
  { key: 'plug-in-hybrid', label: 'Plug-in Hybrid', glyph: 'charging' },
  { key: 'other', label: 'Other', glyph: 'other' },
];

const TRANSMISSIONS: Record<'car' | 'motorcycle', { key: Transmission; label: string; glyph: string }[]> = {
  car: [
    { key: 'manual', label: 'Manual', glyph: 'settings' },
    { key: 'automatic', label: 'Automatic', glyph: 'transfer' },
  ],
  motorcycle: [
    { key: 'manual', label: 'Manual', glyph: 'settings' },
    { key: 'automatic', label: 'Automatic', glyph: 'transfer' },
    { key: 'semi-auto', label: 'Semi-auto', glyph: 'transfer' },
  ],
};

type Open = 'make' | 'model' | 'year' | null;

/**
 * Make and model: three fields plus the powertrain, which decides whether
 * fuel, charging or both appear later, and the transmission. The round QR
 * button opens the optional VIN; Continue goes to the first odometer.
 */
export default function MakeModelScreen() {
  const { draft, update } = useOnboardingDraft();
  const [open, setOpen] = useState<Open>(null);
  const type = draft.vehicleType ?? 'car';
  const table = makeTableFor(type);
  const models = draft.make ? (table[draft.make] ?? []) : [];
  const transmissions = TRANSMISSIONS[type];
  const ok = !!draft.make && !!draft.model && !!draft.year && !!draft.powertrain && transmissions.some((t) => t.key === draft.transmission);

  return (
    <OnboardingScreen
      backLabel="BACK"
      step={{ step: 5, total: 6 }}
      title="Which vehicle?"
      lede="Make, model and year. Carma fills in the variant where it knows it."
      bleed
      footer={
        <View style={styles.foot}>
          <Pressable accessibilityRole="button" onPress={() => router.push('/onboarding/vin')} style={({ pressed }) => [styles.vin, pressed && { backgroundColor: Colors.ctaPressed }]} accessibilityLabel="Add the VIN">
            <IconGlyph glyph="qr" size={64} bg="transparent" fg={Colors.body} scale={0.36} />
          </Pressable>
          <Button style={styles.flex} disabled={!ok} onPress={() => router.push('/onboarding/odometer')}>
            Continue
          </Button>
        </View>
      }>
      <SectionHeader title="VEHICLE" rule inset />
      <View style={styles.fields}>
        <FieldRow label="Make" value={draft.make} onPress={() => setOpen('make')} valueColor={Colors.body} caretColor={Colors.accent} />
        <FieldRow
          label="Model"
          value={draft.model}
          onPress={() => draft.make && setOpen('model')}
          valueColor={Colors.body}
          caretColor={draft.make ? Colors.accent : 'rgba(19,75,156,0.24)'}
        />
        <FieldRow label="Year" value={draft.year ? String(draft.year) : ''} onPress={() => setOpen('year')} valueColor={Colors.body} caretColor={Colors.accent} />
        <FieldInput label="Variant" value={draft.variant} onChangeText={(v) => update({ variant: v })} placeholder={type === 'motorcycle' ? 'ABS · optional' : 'TX-L · optional'} autoCapitalize="characters" />
      </View>
      <SectionHeader title="POWERTRAIN" rule inset />
      <View style={styles.chips}>
        {POWERTRAINS.map((p) => (
          <Chip key={p.key} outline label={p.label} glyph={p.glyph} selected={draft.powertrain === p.key} onPress={() => update({ powertrain: p.key })} />
        ))}
      </View>
      <SectionHeader title="TRANSMISSION" rule inset />
      <View style={styles.chips}>
        {transmissions.map((t) => (
          <Chip key={t.key} outline label={t.label} glyph={t.glyph} selected={draft.transmission === t.key} onPress={() => update({ transmission: t.key })} />
        ))}
      </View>

      <PickerSheet
        visible={open === 'make'}
        title="Pick a make"
        hint={type === 'motorcycle' ? 'MOTORCYCLE MAKES' : 'CAR MAKES'}
        items={Object.keys(table)}
        selected={draft.make}
        onSelect={(v) => {
          update({ make: v, model: v === draft.make ? draft.model : '' });
          setOpen(null);
        }}
        onClose={() => setOpen(null)}
        allowCustom
      />
      <PickerSheet
        visible={open === 'model'}
        title="Pick a model"
        hint={`${draft.make.toUpperCase()} MODELS`}
        items={models}
        selected={draft.model}
        onSelect={(v) => {
          update({ model: v });
          setOpen(null);
        }}
        onClose={() => setOpen(null)}
        allowCustom
      />
      <PickerSheet
        visible={open === 'year'}
        title="Pick a year"
        hint="MODEL YEAR"
        items={YEARS}
        selected={draft.year ? String(draft.year) : undefined}
        onSelect={(v) => {
          update({ year: Number(v) || draft.year });
          setOpen(null);
        }}
        onClose={() => setOpen(null)}
        searchPlaceholder="Jump to a year"
      />
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  fields: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
    gap: 10,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
  },
  foot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  vin: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.cta,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flex: {
    flex: 1,
  },
});
