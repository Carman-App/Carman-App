import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { IconGlyph } from '@/components/ui/IconGlyph';
import { ProgressSteps } from '@/components/ui/ProgressSteps';
import { Screen } from '@/components/ui/Screen';
import { T } from '@/components/ui/Typography';
import { useOnboardingDraft } from '@/features/onboarding/context';
import type { VehicleType } from '@/types/domain';
import { Colors, Radius, Spacing } from '@/theme/tokens';

const OPTIONS: { key: VehicleType; title: string; sub: string; glyph: string }[] = [
  { key: 'car', title: 'Car', sub: 'SALOON · SUV · PICKUP · VAN', glyph: 'vehicle' },
  { key: 'motorcycle', title: 'Motorcycle', sub: 'ROAD · ADVENTURE · SCOOTER', glyph: 'motorcycle' },
];

export default function VehicleTypeScreen() {
  const { draft, update } = useOnboardingDraft();

  return (
    <Screen
      footer={
        <Button onPress={() => router.push('/onboarding/usage')}>
          Continue · {draft.vehicleType === 'car' ? 'Car' : 'Motorcycle'}
        </Button>
      }>
      <ProgressSteps step={4} total={7} />
      <T variant="display">What are you adding?</T>
      <View style={styles.options}>
        {OPTIONS.map((o) => {
          const selected = draft.vehicleType === o.key;
          return (
            <Pressable key={o.key} onPress={() => update({ vehicleType: o.key })} style={[styles.option, selected && styles.optionSelected]}>
              <IconGlyph glyph={o.glyph} size={44} bg={selected ? Colors.accent + '22' : Colors.surfaceMuted} />
              <View style={styles.optionText}>
                <T variant="subheading">{o.title}</T>
                <T variant="eyebrow">{o.sub}</T>
              </View>
            </Pressable>
          );
        })}
      </View>
      <T variant="meta" style={styles.footnote}>
        MORE VEHICLE TYPES COMING
      </T>
    </Screen>
  );
}

const styles = StyleSheet.create({
  options: {
    gap: Spacing.sm,
    marginTop: Spacing.lg,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    padding: Spacing.md,
  },
  optionSelected: {
    borderColor: Colors.accent,
    backgroundColor: Colors.accentSoft,
  },
  optionText: {
    gap: 4,
  },
  footnote: {
    marginTop: Spacing.md,
  },
});
