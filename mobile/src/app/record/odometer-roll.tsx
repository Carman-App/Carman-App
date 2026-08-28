import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { ModalHeader } from '@/components/ui/ModalHeader';
import { Screen } from '@/components/ui/Screen';
import { TextField } from '@/components/ui/TextField';
import { T } from '@/components/ui/Typography';
import { useAccount, useRecords } from '@/data/hooks';
import { addRecord } from '@/data/repo';
import { OdometerQuickAdd } from '@/features/record/OdometerQuickAdd';
import { useResolvedVehicle } from '@/features/record/useResolvedVehicle';
import { formatDateShort, formatNumber, todayIso } from '@/lib/format';
import { Colors, Radius, Spacing } from '@/theme/tokens';

export default function OdometerRollScreen() {
  const { vehicleId } = useLocalSearchParams<{ vehicleId?: string }>();
  const vehicle = useResolvedVehicle(vehicleId);
  const account = useAccount().data;
  const records = useRecords(vehicle?.id).data ?? [];
  const lastOdometerRecord = records.find((r) => r.odometerAtEntry != null);

  const original = vehicle?.odometerKm ?? 0;
  const [reading, setReading] = useState(original);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setClamped = (next: number) => setReading(Math.max(original, next));

  const canSave = !!vehicle && reading >= original;

  const handleSave = async () => {
    if (!vehicle) return;
    setSaving(true);
    setError(null);
    try {
      await addRecord(vehicle.id, {
        type: 'odometer',
        date: todayIso(),
        amount: 0,
        odometerAtEntry: reading,
        enteredByMemberName: account?.name ?? 'You',
        category: 'other',
      });
      router.replace({
        pathname: '/record/saved',
        params: { vehicleId: vehicle.id, amount: '0', kind: 'odometer' },
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
        <ModalHeader eyebrow="ODOMETER" title="No vehicle yet" />
        <T variant="body" color={Colors.textMuted}>
          Add a vehicle first to log a reading.
        </T>
      </Screen>
    );
  }

  return (
    <Screen
      footer={
        <Button disabled={!canSave} loading={saving} onPress={handleSave}>
          Save reading · {formatNumber(reading)} KM
        </Button>
      }>
      <ModalHeader eyebrow={`ODOMETER · ${vehicle.make} ${vehicle.model}`.toUpperCase()} title="Odometer" />
      <T variant="display">Roll it forward.</T>
      <T variant="eyebrow" style={styles.lastReading}>
        LAST RECORDED · {formatNumber(original)} KM{lastOdometerRecord ? ` · READ ${formatDateShort(lastOdometerRecord.date)}` : ''}
      </T>

      <View style={styles.readingRow}>
        <T variant="numericLarge">{formatNumber(reading)}</T>
        <View style={styles.unitBadge}>
          <T variant="eyebrowStrong" color={Colors.accent}>
            KM
          </T>
        </View>
      </View>

      <OdometerQuickAdd value={reading} original={original} min={original} onChange={setClamped} />

      <View style={styles.manual}>
        <TextField
          label="ENTER THE READING"
          value={String(reading)}
          onChangeText={(v) => setClamped(Number(v.replace(/\D/g, '')) || original)}
          keyboardType="number-pad"
        />
      </View>

      <T variant="body" color={Colors.textMuted} style={styles.guardrail}>
        An odometer only counts up. You cannot wind it back below the last reading Carma holds.
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
  lastReading: {
    marginTop: Spacing.xs,
  },
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
  manual: {
    marginTop: Spacing.lg,
  },
  guardrail: {
    marginTop: Spacing.lg,
  },
  error: {
    marginTop: Spacing.sm,
  },
});
