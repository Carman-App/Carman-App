import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { IconGlyph } from '@/components/ui/IconGlyph';
import { PickerSheet } from '@/components/ui/PickerSheet';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { FieldRow, TextField } from '@/components/ui/TextField';
import { makeTableFor, YEARS } from '@/data/vehicleCatalog';
import { useOnboardingDraft } from '@/features/onboarding/context';
import { OnboardingScreen } from '@/features/onboarding/OnboardingScreen';
import { Colors, Spacing } from '@/theme/tokens';
import type { Powertrain } from '@/types/domain';

const POWERTRAINS: { key: Powertrain; label: string }[] = [
  { key: 'diesel', label: 'Diesel' },
  { key: 'petrol', label: 'Petrol' },
  { key: 'electric', label: 'Electric' },
  { key: 'hybrid', label: 'Hybrid' },
];

type Open = 'make' | 'model' | 'year' | null;

/** Make and model: three fields plus the powertrain, which decides whether fuel, charging or both appear later. */
export default function MakeModelScreen() {
  const { draft, update } = useOnboardingDraft();
  const [open, setOpen] = useState<Open>(null);
  const table = makeTableFor(draft.vehicleType);
  const models = draft.make ? (table[draft.make] ?? []) : [];
  const ok = !!draft.make && !!draft.model;

  return (
    <OnboardingScreen
      backLabel="BACK"
      step={{ step: 5, total: 6 }}
      title="Which vehicle?"
      lede="Make, model and year. Carma fills in the variant where it knows it."
      bleed
      footer={
        <View style={styles.foot}>
          <Pressable onPress={() => router.push('/onboarding/vin')} style={({ pressed }) => [styles.vin, pressed && { backgroundColor: Colors.ctaPressed }]} accessibilityLabel="Add the VIN">
            <IconGlyph glyph="qr" size={64} bg="transparent" fg={Colors.body} scale={0.36} />
          </Pressable>
          <Button style={styles.flex} disabled={!ok} onPress={() => router.push('/onboarding/vin')}>
            Continue
          </Button>
        </View>
      }>
      <SectionHeader title="VEHICLE" rule inset />
      <View style={styles.fields}>
        <FieldRow label="Make" value={draft.make} onPress={() => setOpen('make')} />
        <FieldRow label="Model" value={draft.model} onPress={() => setOpen('model')} disabled={!draft.make} />
        <FieldRow label="Year" value={String(draft.year)} onPress={() => setOpen('year')} />
        <TextField value={draft.variant} onChangeText={(v) => update({ variant: v })} placeholder="Variant · optional, e.g. TX-L" />
      </View>
      <SectionHeader title="POWERTRAIN" rule inset />
      <View style={styles.chips}>
        {POWERTRAINS.map((p) => (
          <Chip key={p.key} label={p.label} selected={draft.powertrain === p.key} onPress={() => update({ powertrain: p.key })} />
        ))}
      </View>
      {draft.vehicleType === 'car' ? (
        <>
          <SectionHeader title="TRANSMISSION" rule inset />
          <View style={styles.chips}>
            <Chip label="Automatic" selected={draft.transmission === 'automatic'} onPress={() => update({ transmission: 'automatic' })} />
            <Chip label="Manual" selected={draft.transmission === 'manual'} onPress={() => update({ transmission: 'manual' })} />
          </View>
        </>
      ) : null}

      <PickerSheet
        visible={open === 'make'}
        title="Pick a make"
        items={Object.keys(table)}
        selected={draft.make}
        onSelect={(v) => {
          update({ make: v, model: '' });
          setOpen('model');
        }}
        onClose={() => setOpen(null)}
        searchPlaceholder="Make"
      />
      <PickerSheet
        visible={open === 'model'}
        title={`${draft.make || 'Pick a'} model`}
        items={models}
        selected={draft.model}
        onSelect={(v) => {
          update({ model: v });
          setOpen(null);
        }}
        onClose={() => setOpen(null)}
        searchPlaceholder="Model"
      />
      <PickerSheet
        visible={open === 'year'}
        title="Year"
        items={YEARS}
        selected={String(draft.year)}
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
