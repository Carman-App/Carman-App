import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { ProgressSteps } from '@/components/ui/ProgressSteps';
import { Screen } from '@/components/ui/Screen';
import { TextField } from '@/components/ui/TextField';
import { T } from '@/components/ui/Typography';
import { useOnboardingDraft } from '@/features/onboarding/context';
import { Colors, Radius, Spacing } from '@/theme/tokens';

export default function CreateGarageScreen() {
  const { draft, update } = useOnboardingDraft();

  return (
    <Screen
      footer={
        <Button disabled={!draft.garageName.trim()} onPress={() => router.push('/onboarding/vehicle-type')}>
          Continue
        </Button>
      }>
      <ProgressSteps step={3} total={7} />
      <T variant="display">Create your Garage</T>
      <T variant="body" color={Colors.textMuted} style={styles.sub}>
        A Garage keeps your vehicles, members, expenses and history together.
      </T>
      <View style={styles.field}>
        <TextField
          label="GARAGE NAME"
          value={draft.garageName}
          onChangeText={(v) => update({ garageName: v })}
          placeholder="Name your garage"
          helper="SUGGESTED: MY GARAGE · HOME · WORKSHOP"
          autoFocus
        />
      </View>
      <View style={styles.included}>
        <T variant="eyebrow">INCLUDED: 2 GARAGES · 3 MEMBERS EACH</T>
        <T variant="meta">YOU CAN INVITE MEMBERS LATER</T>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  sub: {
    marginTop: Spacing.xs,
    marginBottom: Spacing.xl,
  },
  field: {
    marginBottom: Spacing.lg,
  },
  included: {
    backgroundColor: Colors.surfaceMuted,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    gap: 4,
  },
});
