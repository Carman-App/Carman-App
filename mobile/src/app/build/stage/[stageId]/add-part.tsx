import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { ModalHeader } from '@/components/ui/ModalHeader';
import { Screen } from '@/components/ui/Screen';
import { TextField } from '@/components/ui/TextField';
import { T } from '@/components/ui/Typography';
import { addPart } from '@/data/repo';
import { formatDateShort, todayIso } from '@/lib/format';
import type { PartStatus } from '@/types/domain';
import { Colors, Radius, Spacing } from '@/theme/tokens';

const STATUSES: { key: PartStatus; label: string }[] = [
  { key: 'on-order', label: 'On order' },
  { key: 'in-storage', label: 'In storage' },
  { key: 'fitted', label: 'Fitted' },
];

export default function AddPartScreen() {
  const { stageId } = useLocalSearchParams<{ stageId: string }>();
  const [name, setName] = useState('');
  const [cost, setCost] = useState('');
  const [brand, setBrand] = useState('');
  const [partNumber, setPartNumber] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [status, setStatus] = useState<PartStatus>('on-order');
  const [date] = useState(todayIso());
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!stageId || !name.trim() || !cost) return;
    setSaving(true);
    await addPart(stageId, {
      name: name.trim(),
      cost: Number(cost) || 0,
      brand: brand.trim() || undefined,
      partNumber: partNumber.trim() || undefined,
      quantity,
      status,
      date,
    });
    setSaving(false);
    router.back();
  };

  return (
    <Screen
      scroll
      footer={
        <Button onPress={save} loading={saving} disabled={!name.trim() || !cost}>
          {!name.trim() ? 'Name the part' : !cost ? 'Enter an amount' : 'Save part'}
        </Button>
      }>
      <ModalHeader eyebrow="PART" />

      <TextField label="AMOUNT" value={cost} onChangeText={setCost} keyboardType="numeric" prefix="KES" helper="SINGLE UNIT" />

      <View style={styles.field}>
        <TextField label="PART" value={name} onChangeText={setName} placeholder="e.g. Front brake pads" />
      </View>
      <View style={styles.field}>
        <TextField label="BRAND" value={brand} onChangeText={setBrand} placeholder="e.g. Bosch" />
      </View>
      <View style={styles.field}>
        <TextField label="PART NUMBER" value={partNumber} onChangeText={setPartNumber} placeholder="e.g. 0986..." />
      </View>

      <T variant="eyebrow" style={styles.fieldLabel}>
        QUANTITY
      </T>
      <View style={styles.stepper}>
        <Pressable style={styles.stepBtn} onPress={() => setQuantity((q) => Math.max(1, q - 1))}>
          <T variant="heading" color={Colors.accent}>
            −
          </T>
        </Pressable>
        <T variant="bodyStrong" style={styles.stepValue}>
          {quantity}
        </T>
        <Pressable style={styles.stepBtn} onPress={() => setQuantity((q) => q + 1)}>
          <T variant="heading" color={Colors.accent}>
            +
          </T>
        </Pressable>
      </View>

      <T variant="eyebrow" style={styles.fieldLabel}>
        STATUS
      </T>
      <View style={styles.chipRow}>
        {STATUSES.map((s) => (
          <Pressable key={s.key} style={[styles.chip, status === s.key && styles.chipSelected]} onPress={() => setStatus(s.key)}>
            <T variant="meta" color={status === s.key ? Colors.white : Colors.textMuted} style={{ fontFamily: undefined }}>
              {s.label.toUpperCase()}
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
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  stepBtn: {
    width: 40,
    height: 40,
    borderRadius: Radius.pill,
    backgroundColor: Colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepValue: {
    minWidth: 32,
    textAlign: 'center',
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
