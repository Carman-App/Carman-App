import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { ProgressSteps } from '@/components/ui/ProgressSteps';
import { Screen } from '@/components/ui/Screen';
import { TextField } from '@/components/ui/TextField';
import { T } from '@/components/ui/Typography';
import { useOnboardingDraft } from '@/features/onboarding/context';
import { completeOnboarding } from '@/data/repo';
import { formatNumber } from '@/lib/format';
import { Colors, Radius, Spacing } from '@/theme/tokens';

const STEPS = [
  { label: '+100', value: 100 },
  { label: '+1,000', value: 1000 },
  { label: '+10,000', value: 10000 },
  { label: '+100,000', value: 100000 },
];

export default function OdometerScreen() {
  const { draft, update } = useOnboardingDraft();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleContinue = async () => {
    setSaving(true);
    setError(null);
    try {
      const vehicle = await completeOnboarding({
        name: draft.name,
        email: draft.email,
        region: draft.region,
        profile: draft.profile,
        garageName: draft.garageName,
        garageLocation: draft.garageLocation,
        vehicle: {
          type: draft.vehicleType,
          usage: draft.usage,
          make: draft.make,
          model: draft.model,
          variant: draft.variant || undefined,
          year: draft.year,
          odometerKm: draft.odometerKm,
          powertrain: draft.powertrain,
        },
      });
      update({ vehicleId: vehicle.id });
      router.push('/onboarding/vehicle-added');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen
      footer={
        <Button loading={saving} onPress={handleContinue}>
          Continue
        </Button>
      }>
      <ProgressSteps step={7} total={7} />
      <T variant="display">What&apos;s on the odometer?</T>
      <View style={styles.readingRow}>
        <T variant="numericLarge">{formatNumber(draft.odometerKm)}</T>
        <View style={styles.unitBadge}>
          <T variant="eyebrowStrong" color={Colors.accent}>
            KM
          </T>
        </View>
      </View>
      <T variant="meta" style={styles.hint}>
        DRAG THE SCALE OR TAP A STEP TO ADD IT
      </T>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.stepsRow} contentContainerStyle={{ gap: Spacing.xs }}>
        {STEPS.map((s) => (
          <Pressable key={s.label} style={styles.stepChip} onPress={() => update({ odometerKm: draft.odometerKm + s.value })}>
            <T variant="bodyStrong" color={Colors.accent}>
              {s.label}
            </T>
          </Pressable>
        ))}
        <Pressable style={styles.stepChip} onPress={() => update({ odometerKm: 0 })}>
          <T variant="bodyStrong" color={Colors.textMuted}>
            UNDO
          </T>
        </Pressable>
      </ScrollView>
      <View style={styles.manual}>
        <TextField
          label="ENTER THE READING"
          value={draft.odometerKm ? String(draft.odometerKm) : ''}
          onChangeText={(v) => update({ odometerKm: Number(v.replace(/\D/g, '')) || 0 })}
          keyboardType="number-pad"
          placeholder="0"
        />
      </View>
      <T variant="body" color={Colors.textMuted} style={styles.footnote}>
        Carma uses your odometer to track maintenance intervals, running costs and history.
      </T>
      {error ? (
        <T variant="body" color={Colors.danger} center style={styles.error}>
          {error}
        </T>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  readingRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.sm,
    marginTop: Spacing.xl,
  },
  unitBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Radius.pill,
    backgroundColor: Colors.accentSoft,
  },
  hint: {
    marginTop: Spacing.xs,
  },
  stepsRow: {
    marginTop: Spacing.md,
  },
  stepChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.pill,
    backgroundColor: Colors.surfaceMuted,
  },
  manual: {
    marginTop: Spacing.xl,
  },
  footnote: {
    marginTop: Spacing.lg,
  },
  error: {
    marginTop: Spacing.sm,
  },
});
