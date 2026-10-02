import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Footnote, KeyValueRow, Rule } from '@/components/ui/Blocks';
import { Button } from '@/components/ui/Button';
import { DateSheet } from '@/components/ui/DateSheet';
import { Screen } from '@/components/ui/Screen';
import { TextField } from '@/components/ui/TextField';
import { T } from '@/components/ui/Typography';
import { TopBar } from '@/components/ui/TopBar';
import { useAccount, useRecord, useVehicle } from '@/data/hooks';
import { deleteRecord, updateRecord } from '@/data/repo';
import { formatDateLong, formatNumber, formatPlate } from '@/lib/format';
import { Colors, Spacing } from '@/theme/tokens';
import { REGION_UNITS } from '@/types/domain';

const TYPE_LABEL: Record<string, string> = {
  fuel: 'Fuel',
  service: 'Service',
  repair: 'Repair',
  part: 'Part',
  expense: 'Expense',
  odometer: 'Odometer reading',
};

const parseNum = (s: string) => {
  const n = Number(s.replace(/[,\s]/g, ''));
  return s.trim() && !Number.isNaN(n) ? n : undefined;
};

/** Edit a saved record. Corrections are marked so the history stays honest. */
export default function EditRecordScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const recordQuery = useRecord(id);
  const record = recordQuery.data;
  const vehicle = useVehicle(record?.vehicleId).data;
  const account = useAccount().data;
  const currency = account ? (REGION_UNITS[account.region]?.currency ?? 'KES') : 'KES';

  // Edits are kept as overrides on top of the record, so a record that loads after mount still fills the form.
  const [edits, setEdits] = useState<{ amount?: string; date?: string; place?: string; litres?: string; odometer?: string }>({});
  const [picking, setPicking] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // useRecord reads an already-fetched list's cache; wait for it before saying the record is gone.
  if (recordQuery.isPending) {
    return (
      <Screen header={<TopBar backLabel="TIMELINE" />}>
        <View style={styles.center}>
          <ActivityIndicator color={Colors.accent} />
        </View>
      </Screen>
    );
  }

  if (!record) {
    return (
      <Screen header={<TopBar backLabel="TIMELINE" />}>
        <T variant="lede" style={styles.center}>
          This record is no longer on the timeline.
        </T>
      </Screen>
    );
  }

  const isOdo = record.type === 'odometer';
  const amount = edits.amount ?? String(record.amount);
  const date = edits.date ?? record.date;
  const place = edits.place ?? record.place ?? '';
  const litres = edits.litres ?? (record.litres !== undefined ? String(record.litres) : '');
  const odometer = edits.odometer ?? (record.odometerAtEntry ? String(record.odometerAtEntry) : '');
  const set = (k: keyof typeof edits) => (v: string) => setEdits((e) => ({ ...e, [k]: v }));

  const patch = {
    amount: parseNum(amount),
    date,
    place: place.trim() || undefined,
    litres: parseNum(litres),
    odometerAtEntry: parseNum(odometer),
  };
  const changed =
    (!isOdo && patch.amount !== record.amount) ||
    date !== record.date ||
    (patch.place ?? '') !== (record.place ?? '') ||
    (record.type === 'fuel' && patch.litres !== record.litres) ||
    (patch.odometerAtEntry ?? 0) !== (record.odometerAtEntry ?? 0);
  const valid = isOdo ? !!patch.odometerAtEntry : !!patch.amount && patch.amount > 0;

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await updateRecord(record.id, {
        amount: isOdo ? undefined : patch.amount,
        date: patch.date,
        place: patch.place,
        litres: record.type === 'fuel' ? patch.litres : undefined,
        odometerAtEntry: patch.odometerAtEntry,
      });
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Try again.');
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setDeleting(true);
    setError(null);
    try {
      await deleteRecord(record.id);
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Try again.');
      setDeleting(false);
    }
  };

  return (
    <Screen
      header={<TopBar backLabel="TIMELINE" right="EDIT RECORD" />}
      footer={
        <Button disabled={!changed || !valid} loading={saving} onPress={save}>
          {!valid ? (isOdo ? 'Enter the reading' : 'Enter the amount') : changed ? 'Save changes' : 'No changes yet'}
        </Button>
      }>
      <View style={styles.head}>
        <T variant="eyebrow" color={Colors.body}>
          {[vehicle?.model, formatPlate(vehicle?.plate)].filter(Boolean).join(' · ').toUpperCase()}
        </T>
        <T variant="display">{TYPE_LABEL[record.type] ?? 'Record'}{record.place ? ` at ${record.place}` : ''}</T>
        <T variant="meta">Added by {record.enteredByMemberName}</T>
      </View>

      <View style={styles.section}>
        {isOdo ? null : (
          <TextField label="Amount" value={amount} onChangeText={set('amount')} keyboardType="decimal-pad" prefix={currency} emphasis />
        )}
        {record.type === 'fuel' ? <TextField label="Litres" value={litres} onChangeText={set('litres')} keyboardType="decimal-pad" suffix="L" /> : null}
        <TextField
          label="Odometer"
          value={odometer}
          onChangeText={set('odometer')}
          keyboardType="number-pad"
          suffix="km"
          placeholder={vehicle ? formatNumber(vehicle.odometerKm) : undefined}
        />
        {isOdo ? null : <TextField label="Where" value={place} onChangeText={set('place')} placeholder="Station, workshop or shop" />}
      </View>
      <Rule />
      <KeyValueRow label="Date" value={formatDateLong(date)} valueColor={Colors.accent} onPress={() => setPicking(true)} last />

      {error ? (
        <T variant="body" color={Colors.signal} style={styles.error}>
          {error}
        </T>
      ) : null}

      <Rule />
      <View style={styles.section}>
        <Button variant="danger" size="md" loading={deleting} onPress={remove}>
          {confirmDelete ? 'Tap again to delete for good' : 'Delete this record'}
        </Button>
        <Footnote>REMOVES IT FROM THE TIMELINE AND FROM EVERY TOTAL. CORRECTIONS ARE MARKED ON THE RECORD SO THE HISTORY STAYS HONEST.</Footnote>
      </View>

      <DateSheet visible={picking} value={date} onSelect={set('date')} onClose={() => setPicking(false)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xl,
  },
  head: {
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
    gap: 8,
  },
  section: {
    paddingVertical: Spacing.md,
    gap: 14,
  },
  error: {
    marginTop: Spacing.md,
  },
});
