import type { UseQueryResult } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { ModalHeader } from '@/components/ui/ModalHeader';
import { Screen } from '@/components/ui/Screen';
import { TextField } from '@/components/ui/TextField';
import { T } from '@/components/ui/Typography';
import { useBuildStage } from '@/data/hooks';
import { addModification } from '@/data/repo';
import { formatDateShort, getActiveCurrency, todayIso } from '@/lib/format';
import type { BuildStage, ModificationArea } from '@/types/domain';
import { Colors, Radius, Spacing } from '@/theme/tokens';

const AREAS: ModificationArea[] = ['suspension', 'engine', 'brakes', 'wheels', 'exterior', 'interior', 'electrics', 'drivetrain'];

export default function AddModificationScreen() {
  const { stageId } = useLocalSearchParams<{ stageId: string }>();
  // `useBuildStage`'s `data` comes back as `unknown` (see hooks.ts — it reads
  // `queryClient.getQueryData` with no type argument); cast to what it
  // actually holds (seeded by `seedStageCaches`).
  const { data: stage } = useBuildStage(stageId) as UseQueryResult<BuildStage, Error>;
  const [name, setName] = useState('');
  const [cost, setCost] = useState('');
  const [area, setArea] = useState<ModificationArea | undefined>(undefined);
  const [date] = useState(todayIso());
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!stageId || !name.trim() || !cost) return;
    setSaving(true);
    await addModification(stageId, { name: name.trim(), cost: Number(cost) || 0, area, date });
    setSaving(false);
    router.back();
  };

  return (
    <Screen
      scroll
      footer={
        <Button onPress={save} loading={saving} disabled={!name.trim() || !cost}>
          {!name.trim() ? 'Name the modification' : !cost ? 'Enter an amount' : 'Save modification'}
        </Button>
      }>
      <ModalHeader eyebrow="MODIFICATION" />

      <TextField label="AMOUNT" value={cost} onChangeText={setCost} keyboardType="numeric" prefix={getActiveCurrency()} helper="PARTS AND LABOUR COMBINED" />

      <View style={styles.field}>
        <TextField label="WHAT CHANGED" value={name} onChangeText={setName} placeholder="e.g. Front coilovers" />
      </View>

      <T variant="eyebrow" style={styles.fieldLabel}>
        AREA
      </T>
      <View style={styles.chipRow}>
        {AREAS.map((a) => (
          <Pressable key={a} style={[styles.chip, area === a && styles.chipSelected]} onPress={() => setArea(a)}>
            <T variant="meta" color={area === a ? Colors.white : Colors.textMuted} style={{ fontFamily: undefined }}>
              {a.toUpperCase()}
            </T>
          </Pressable>
        ))}
      </View>

      <T variant="eyebrow" style={styles.fieldLabel}>
        DATE
      </T>
      <View style={styles.dateRow}>
        <T variant="bodyStrong">{formatDateShort(date)}</T>
        <View style={styles.todayPill}>
          <T variant="meta" color={Colors.accent} style={{ fontFamily: undefined }}>
            TODAY
          </T>
        </View>
      </View>

      {stage ? (
        <>
          <T variant="eyebrow" style={styles.fieldLabel}>
            STAGE
          </T>
          <T variant="bodyStrong">{stage.name}</T>
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  field: {
    marginTop: Spacing.lg,
  },
  fieldLabel: {
    marginTop: Spacing.lg,
    marginBottom: Spacing.xs,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  chip: {
    backgroundColor: Colors.surfaceMuted,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 8,
  },
  chipSelected: {
    backgroundColor: Colors.accent,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  todayPill: {
    backgroundColor: Colors.accentSoft,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
  },
});
