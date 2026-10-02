import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { TextField } from '@/components/ui/TextField';
import { T } from '@/components/ui/Typography';
import { useRecord, useVehicle } from '@/data/hooks';
import { deleteRecord, updateRecord } from '@/data/repo';
import { formatDateLong, formatPlate, formatVolume, getActiveCurrency } from '@/lib/format';
import { Colors, Spacing } from '@/theme/tokens';

const TYPE_LABEL: Record<string, string> = {
  fuel: 'Fuel',
  service: 'Service',
  repair: 'Repair',
  part: 'Part',
  expense: 'Expense',
  odometer: 'Odometer reading',
};

export default function EditRecordScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const recordQuery = useRecord(id);
  const record = recordQuery.data;
  const vehicle = useVehicle(record?.vehicleId).data;

  const [amount, setAmount] = useState(record ? String(record.amount) : '');
  const [date, setDate] = useState(record?.date ?? '');
  const [detail, setDetail] = useState(record?.place ?? record?.notes ?? '');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const what = useMemo(() => {
    if (!record) return '';
    const label = TYPE_LABEL[record.type] ?? 'Record';
    return record.type === 'fuel' && record.litres ? `${label} · ${formatVolume(record.litres)}` : label;
  }, [record]);

  const changed = !!record && (Number(amount) !== record.amount || date !== record.date || detail !== (record.place ?? record.notes ?? ''));

  // `useRecord` has no GET-by-id endpoint to fall back on — it only reads an
  // already-fetched list's cache (see @/data/hooks). Don't show "not found"
  // while that lookup query is still settling on first mount.
  if (recordQuery.isLoading) {
    return (
      <Screen>
        <BackLink />
        <View style={styles.center}>
          <ActivityIndicator color={Colors.accent} />
        </View>
      </Screen>
    );
  }

  if (!record) {
    return (
      <Screen>
        <BackLink />
        <T variant="body" color={Colors.textMuted}>
          Record not found.
        </T>
      </Screen>
    );
  }

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await updateRecord(record.id, {
        amount: Number(amount) || record.amount,
        date: date || record.date,
        place: detail || undefined,
      });
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    setError(null);
    try {
      await deleteRecord(record.id);
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Try again.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Screen
      footer={
        <Button variant="secondary" disabled={!changed} loading={saving} onPress={handleSave}>
          {changed ? 'Save changes' : 'No changes yet'}
        </Button>
      }>
      <BackLink />
      <T variant="display">
        {what} · {formatPlate(vehicle?.plate)}
      </T>
      <T variant="eyebrow" style={styles.addedBy}>
        ADDED BY {record.enteredByMemberName.toUpperCase()}
      </T>

      <View style={styles.form}>
        <TextField label="WHAT" value={what} onChangeText={() => {}} />
        <TextField label="AMOUNT" value={amount} onChangeText={(v) => setAmount(v.replace(/[^\d.]/g, ''))} keyboardType="decimal-pad" prefix={getActiveCurrency()} />
        <TextField label="DATE" value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" helper={date ? formatDateLong(date) : undefined} />
        <TextField label="DETAIL" value={detail} onChangeText={setDetail} placeholder="Place or notes" multiline />

        <View>
          <T variant="eyebrow">ATTACHMENTS</T>
          <View style={styles.attachRow}>
            <T variant="bodyStrong" color={Colors.textMuted}>
              NONE
            </T>
            <Pressable onPress={() => {}}>
              <T variant="bodyStrong" color={Colors.accent}>
                + Attach
              </T>
            </Pressable>
          </View>
        </View>
      </View>

      {error ? (
        <T variant="body" color={Colors.error} center style={styles.error}>
          {error}
        </T>
      ) : null}

      <View style={styles.dangerZone}>
        <Button variant="danger" loading={deleting} onPress={handleDelete}>
          Delete this record
        </Button>
        <T variant="meta" color={Colors.textMuted} style={styles.dangerHelper}>
          REMOVES IT FROM THE TIMELINE AND FROM EVERY TOTAL
        </T>
      </View>

      <T variant="meta" color={Colors.textFaint} style={styles.footnote}>
        CORRECTIONS ARE MARKED ON THE RECORD SO THE HISTORY STAYS HONEST.
      </T>
    </Screen>
  );
}

function BackLink() {
  return (
    <Pressable onPress={() => router.back()} style={styles.backLink}>
      <T variant="eyebrowStrong" color={Colors.accent}>
        ← TIMELINE
      </T>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xxxl,
  },
  backLink: {
    marginBottom: Spacing.md,
  },
  addedBy: {
    marginTop: Spacing.xs,
    marginBottom: Spacing.lg,
  },
  form: {
    gap: Spacing.lg,
  },
  attachRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 2,
  },
  error: {
    marginTop: Spacing.lg,
  },
  dangerZone: {
    marginTop: Spacing.xl,
    gap: Spacing.xs,
  },
  dangerHelper: {
    textAlign: 'center',
  },
  footnote: {
    marginTop: Spacing.lg,
    textAlign: 'center',
  },
});
