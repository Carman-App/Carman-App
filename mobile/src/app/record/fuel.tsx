import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { ModalHeader } from '@/components/ui/ModalHeader';
import { Screen } from '@/components/ui/Screen';
import { TextField } from '@/components/ui/TextField';
import { T } from '@/components/ui/Typography';
import { useAccount } from '@/data/hooks';
import { addRecord } from '@/data/repo';
import { DateQuickPick } from '@/features/record/DateQuickPick';
import { OdometerQuickAdd } from '@/features/record/OdometerQuickAdd';
import { useResolvedVehicle } from '@/features/record/useResolvedVehicle';
import { getActiveCurrency, getActiveVolumeUnit, L_TO_GAL, todayIso } from '@/lib/format';
import { Colors, Spacing } from '@/theme/tokens';

export default function FuelEntryScreen() {
  const { vehicleId } = useLocalSearchParams<{ vehicleId?: string }>();
  const vehicle = useResolvedVehicle(vehicleId);
  const account = useAccount().data;

  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayIso());
  const [place, setPlace] = useState('');
  const [litres, setLitres] = useState('');
  const [odometer, setOdometer] = useState(String(vehicle?.odometerKm ?? 0));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Price per litre — a rate, not a plain volume, so `formatVolume` doesn't
  // apply. Converted to price-per-gallon the same way `formatVolume` would
  // (branch on the active unit, no-op for litres) but inverted: a per-gallon
  // rate is per-litre divided by litres-per-gallon, not multiplied. The
  // "LITRES ADDED" field itself still collects a litre figure either way —
  // only this derived display adapts to the account's volume unit.
  const unitPrice = useMemo(() => {
    const a = Number(amount);
    const l = Number(litres);
    if (!a || !l) return null;
    const perLitre = a / l;
    return getActiveVolumeUnit() === 'gal' ? perLitre / L_TO_GAL : perLitre;
  }, [amount, litres]);

  const canSave = !!vehicle && Number(amount) > 0;

  const handleSave = async () => {
    if (!vehicle) return;
    setSaving(true);
    setError(null);
    try {
      await addRecord(vehicle.id, {
        type: 'fuel',
        date,
        amount: Number(amount) || 0,
        odometerAtEntry: Number(odometer) || vehicle.odometerKm,
        place: place.trim() || undefined,
        litres: Number(litres) || undefined,
        enteredByMemberName: account?.name ?? 'You',
        category: 'fuel',
      });
      router.replace({
        pathname: '/record/saved',
        params: { vehicleId: vehicle.id, amount: String(Number(amount) || 0), kind: 'fuel' },
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
        <ModalHeader eyebrow="FUEL" title="No vehicle yet" />
        <T variant="body" color={Colors.textMuted}>
          Add a vehicle first to log fuel.
        </T>
      </Screen>
    );
  }

  return (
    <Screen
      footer={
        <Button disabled={!canSave} loading={saving} onPress={handleSave}>
          Save fuel record
        </Button>
      }>
      <ModalHeader eyebrow={`FUEL · ${vehicle.make} ${vehicle.model}`.toUpperCase()} title="Fuel" />
      <View style={styles.form}>
        <TextField label="AMOUNT SPENT" value={amount} onChangeText={(v) => setAmount(v.replace(/[^\d.]/g, ''))} keyboardType="decimal-pad" placeholder="0" prefix={getActiveCurrency()} />

        <View>
          <T variant="eyebrow">DATE</T>
          <View style={styles.dateWrap}>
            <DateQuickPick value={date} onChange={setDate} onOpenPicker={() => router.push('/record/pick-date')} />
          </View>
        </View>

        <TextField label="STATION" value={place} onChangeText={setPlace} placeholder="Pick a station" />

        <TextField label="LITRES ADDED" value={litres} onChangeText={(v) => setLitres(v.replace(/[^\d.]/g, ''))} keyboardType="decimal-pad" placeholder="0" />

        <View>
          <T variant="eyebrow">UNIT PRICE</T>
          <T variant="bodyStrong" color={unitPrice == null ? Colors.textMuted : undefined} style={styles.unitPrice}>
            {unitPrice != null ? `${getActiveCurrency()} ${unitPrice.toFixed(2)} / ${getActiveVolumeUnit().toUpperCase()}` : 'ADD BOTH TO SEE THIS'}
          </T>
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
  dateWrap: {
    marginTop: 2,
  },
  unitPrice: {
    marginTop: 2,
  },
});
