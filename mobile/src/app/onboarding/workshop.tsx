import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Footnote } from '@/components/ui/Blocks';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { FieldRow, TextField } from '@/components/ui/TextField';
import { T } from '@/components/ui/Typography';
import { completeWorkshopOnboarding } from '@/data/repo';
import { useOnboardingDraft } from '@/features/onboarding/context';
import { COUNTRIES } from '@/features/onboarding/countries';
import { OnboardingScreen } from '@/features/onboarding/OnboardingScreen';
import { Colors, Spacing } from '@/theme/tokens';

/** Mechanic set up: country and business, and set up is done. No logo, bank details or tax form. */
export default function WorkshopSetupScreen() {
  const { draft, update } = useOnboardingDraft();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const country = COUNTRIES.find((c) => c.region === draft.region);
  const ok = draft.businessName.trim().length > 1;

  const create = async () => {
    setSaving(true);
    setError(null);
    try {
      await completeWorkshopOnboarding({ region: draft.region, name: draft.name, businessName: draft.businessName });
      router.replace('/onboarding/first-job');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Try again.');
      setSaving(false);
    }
  };

  return (
    <OnboardingScreen
      step={{ step: 1, total: 2, label: 'WORKSHOP' }}
      title="What goes on your invoices?"
      lede="Name, country and town. No logo, bank details or tax form."
      bleed
      footer={
        <>
          {error ? (
            <T variant="meta" color={Colors.danger} center>
              {error}
            </T>
          ) : null}
          <Button disabled={!ok} loading={saving} onPress={create}>
            Create the profile
          </Button>
        </>
      }>
      <SectionHeader title="BUSINESS" rule inset />
      <View style={styles.fields}>
        <TextField value={draft.businessName} onChangeText={(v) => update({ businessName: v })} placeholder="Business name, e.g. Joe’s Auto" autoCapitalize="words" />
        <FieldRow label="Country" value={country?.name} caret={false} />
        <TextField value={draft.businessTown} onChangeText={(v) => update({ businessTown: v })} placeholder="Town" autoCapitalize="words" />
      </View>
      <SectionHeader title="HOW YOU WORK" rule inset />
      <View style={styles.chips}>
        <Chip label="On my own" selected={draft.teamSize === 'solo'} onPress={() => update({ teamSize: 'solo' })} />
        <Chip label="With a helper" selected={draft.teamSize === 'helper'} onPress={() => update({ teamSize: 'helper' })} />
        <Chip label="A workshop team" selected={draft.teamSize === 'team'} onPress={() => update({ teamSize: 'team' })} />
      </View>
      <View style={styles.note}>
        <Footnote>EVERY JOB RECORDS WHO DID THE WORK, SO A HELPER OR A TEAM CAN BE ADDED WITHOUT RESTARTING SET UP.</Footnote>
      </View>
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
  note: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.line,
  },
});
