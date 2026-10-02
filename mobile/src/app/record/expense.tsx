import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { ModalHeader } from '@/components/ui/ModalHeader';
import { Screen } from '@/components/ui/Screen';
import { TextField } from '@/components/ui/TextField';
import { T } from '@/components/ui/Typography';
import { useAccount } from '@/data/hooks';
import { addRecord } from '@/data/repo';
import { findCategoryByLabel } from '@/features/record/categories';
import { DateQuickPick } from '@/features/record/DateQuickPick';
import { OdometerQuickAdd } from '@/features/record/OdometerQuickAdd';
import { useResolvedVehicle } from '@/features/record/useResolvedVehicle';
import { getActiveCurrency, todayIso } from '@/lib/format';
import { Colors, Spacing } from '@/theme/tokens';

export default function ExpenseEntryScreen() {
  const { vehicleId, categoryLabel } = useLocalSearchParams<{ vehicleId?: string; categoryLabel?: string }>();
  const vehicle = useResolvedVehicle(vehicleId);
  const account = useAccount().data;
  const category = findCategoryByLabel(categoryLabel);

  const [amount, setAmount] = useState('');
  const [subtype, setSubtype] = useState<string | undefined>(category.subtypes?.[0]);
  const [place, setPlace] = useState('');
  const [date, setDate] = useState(todayIso());
  const [attached, setAttached] = useState(false);
  const [odometer, setOdometer] = useState(String(vehicle?.odometerKm ?? 0));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSave = !!vehicle && Number(amount) > 0;

  const handleSave = async () => {
    if (!vehicle) return;
    setSaving(true);
    setError(null);
    try {
      await addRecord(vehicle.id, {
        type: category.type ?? 'expense',
        date,
        amount: Number(amount) || 0,
        odometerAtEntry: Number(odometer) || vehicle.odometerKm,
        place: place.trim() || undefined,
        enteredByMemberName: account?.name ?? 'You',
        category: category.category ?? 'other',
        notes: subtype,
      });
      router.replace({
        pathname: '/record/saved',
        params: { vehicleId: vehicle.id, amount: String(Number(amount) || 0), kind: 'expense' },
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Try again.');
    } finally {
      setSaving(false);
    }
  };

  if (!vehicle) {
    return (
      <Screen>
        <ModalHeader eyebrow="ADD RECORD" title="No vehicle yet" />
        <T variant="body" color={Colors.textMuted}>
          Add a vehicle first to log a record.
        </T>
      </Screen>
    );
  }

  return (
    <Screen
      footer={
        <Button disabled={!canSave} loading={saving} onPress={handleSave}>
          {canSave ? 'Save record' : 'Enter an amount'}
        </Button>
      }>
      <ModalHeader eyebrow={`${category.label} · ${vehicle.make} ${vehicle.model}`.toUpperCase()} title={category.label} />
      <View style={styles.form}>
        <TextField label="AMOUNT" value={amount} onChangeText={(v) => setAmount(v.replace(/[^\d.]/g, ''))} keyboardType="decimal-pad" placeholder="0" prefix={getActiveCurrency()} />

        {category.subtypes && category.subtypes.length > 0 ? (
          <View>
            <T variant="eyebrow" style={styles.label}>
              WHAT KIND · PICK ANY
            </T>
            <View style={styles.chipsRow}>
              {category.subtypes.map((s) => (
                <Chip key={s} label={s} selected={subtype === s} onPress={() => setSubtype(s)} />
              ))}
            </View>
          </View>
        ) : null}

        <TextField label="WHERE" value={place} onChangeText={setPlace} placeholder="Add a place" />

        <View>
          <T variant="eyebrow">DATE</T>
          <View style={styles.dateWrap}>
            <DateQuickPick value={date} onChange={setDate} onOpenPicker={() => router.push('/record/pick-date')} />
          </View>
        </View>

        <View>
          <T variant="eyebrow" style={styles.label}>
            RECEIPT
          </T>
          <Pressable style={styles.attachBtn} onPress={() => setAttached((v) => !v)}>
            <T variant="bodyStrong" color={Colors.accent}>
              {attached ? '✓ Attached' : '+ Attach'}
            </T>
          </Pressable>
        </View>

        <View>
          <TextField label="ODOMETER NOW" value={odometer} onChangeText={(v) => setOdometer(v.replace(/\D/g, ''))} keyboardType="number-pad" prefix="KM" />
          <OdometerQuickAdd value={Number(odometer) || 0} original={vehicle.odometerKm} onChange={(next) => setOdometer(String(next))} />
        </View>

        {error ? (
          <T variant="body" color={Colors.error} center>
            {error}
          </T>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: Spacing.lg,
  },
  label: {
    marginBottom: Spacing.xs,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  dateWrap: {
    marginTop: 2,
  },
  attachBtn: {
    alignSelf: 'flex-start',
  },
});
