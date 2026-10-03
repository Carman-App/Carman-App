import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Footnote } from '@/components/ui/Blocks';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { FieldInput, FieldRow } from '@/components/ui/TextField';
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
  // Design: Create the profile once the business is named and "How you work" is chosen.
  const ok = draft.businessName.trim().length > 1 && !!draft.teamSize;

  const create = async () => {
    setSaving(true);
    setError(null);
    try {
      const workshop = await completeWorkshopOnboarding({
        region: draft.region,
        name: draft.name,
        businessName: draft.businessName,
        town: draft.businessTown,
        teamSize: draft.teamSize,
        workshopId: draft.workshopId,
      });
      update({ workshopId: workshop.id });
      setSaving(false);
      router.push('/onboarding/first-job');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Try again.');
      setSaving(false);
    }
  };

  return (
    <OnboardingScreen
      backLabel="BACK"
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
        <FieldInput label="Business" value={draft.businessName} onChangeText={(v) => update({ businessName: v })} placeholder="e.g. Joe’s Auto" />
        <FieldRow label="Country" value={country?.name} caret={false} valueColor={Colors.body} />
        <FieldInput label="Town" value={draft.businessTown} onChangeText={(v) => update({ businessTown: v })} placeholder="e.g. Nairobi" />
      </View>
      <SectionHeader title="HOW YOU WORK" rule inset />
      <View style={styles.chips}>
        <Chip outline label="On my own" selected={draft.teamSize === 'solo'} onPress={() => update({ teamSize: 'solo' })} />
        <Chip outline label="With a helper" selected={draft.teamSize === 'helper'} onPress={() => update({ teamSize: 'helper' })} />
        <Chip outline label="A workshop team" selected={draft.teamSize === 'team'} onPress={() => update({ teamSize: 'team' })} />
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
