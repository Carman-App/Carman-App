import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { KeyValueRow, Rule } from '@/components/ui/Blocks';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { DateSheet } from '@/components/ui/DateSheet';
import { Screen } from '@/components/ui/Screen';
import { T } from '@/components/ui/Typography';
import { TopBar } from '@/components/ui/TopBar';
import { useAccount, useRecords, useReminders } from '@/data/hooks';
import { addRecord } from '@/data/repo';
import { useResolvedVehicle } from '@/features/record/useResolvedVehicle';
import { daysUntil, formatDateLong, formatDateShort, formatNumber, todayIso } from '@/lib/format';
import { costPerKm } from '@/lib/spend';
import { Colors, FontFamily, Spacing } from '@/theme/tokens';
import { REGION_UNITS } from '@/types/domain';

function isoDaysAgo(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * New reading. A reading is its own record: it moves reminders and cost per
 * km, and creates no expense.
 */
export default function OdometerReadingScreen() {
  const { vehicleId } = useLocalSearchParams<{ vehicleId?: string }>();
  const vehicle = useResolvedVehicle(vehicleId);
  const account = useAccount().data;
  const records = useRecords(vehicle?.id).data ?? [];
  const reminders = useReminders(vehicle?.id).data ?? [];
  const currency = account ? (REGION_UNITS[account.region]?.currency ?? 'KES') : 'KES';
  const [text, setText] = useState('');
  const [date, setDate] = useState(todayIso());
  const [picking, setPicking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!vehicle) {
    return (
      <Screen header={<TopBar title="New reading" />}>
        <T variant="lede" style={{ paddingTop: Spacing.xl }}>
          Add a vehicle first, then log its odometer here.
        </T>
      </Screen>
    );
  }

  const last = records.filter((r) => r.odometerAtEntry > 0).sort((a, b) => (a.date < b.date ? 1 : -1))[0];
  const lastKm = Math.max(vehicle.odometerKm, last?.odometerAtEntry ?? 0);
  const reading = Number(text.replace(/[,\s]/g, '')) || 0;
  const delta = reading - lastKm;
  const days = last ? Math.max(1, -daysUntil(last.date) + (date === todayIso() ? 0 : daysUntil(date))) : null;
  const nextService = vehicle.nextServiceDueKm ?? reminders.find((r) => r.kind === 'service-due' && r.dueKm)?.dueKm;
  const cpkBefore = costPerKm(records);
  const cpkAfter = reading > lastKm ? costPerKm([...records, { ...records[0], id: 'x', type: 'odometer', amount: 0, odometerAtEntry: reading, date } as never]) : cpkBefore;
  const valid = reading > 0 && reading >= lastKm;

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await addRecord(vehicle.id, {
        type: 'odometer',
        date,
        amount: 0,
        odometerAtEntry: reading,
        enteredByMemberName: account?.name ?? 'You',
        category: 'other',
      });
      router.replace({ pathname: '/record/saved', params: { vehicleId: vehicle.id, amount: '0', kind: 'odometer', reading: String(reading) } });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save. Try again.');
      setSaving(false);
    }
  };

  return (
    <Screen
      header={<TopBar title="New reading" right={vehicle.model} />}
      headerRule
      footer={
        <>
          {error ? (
            <T variant="meta" color={Colors.danger} center>
              {error}
            </T>
          ) : null}
          <Button disabled={!valid} loading={saving} onPress={save}>
            {reading > 0 && reading < lastKm ? `Below the last reading of ${formatNumber(lastKm)}` : 'Save reading'}
          </Button>
        </>
      }>
      <View style={styles.figure}>
        <TextInput
          value={text}
          onChangeText={(v) => setText(v.replace(/[^\d,]/g, ''))}
          placeholder={formatNumber(lastKm)}
          placeholderTextColor={Colors.lineStrong}
          keyboardType="number-pad"
          autoFocus
          style={styles.input}
        />
        <T style={styles.unit}>km</T>
      </View>
      <View style={styles.lastRow}>
        <T variant="meta">
          Last: {formatNumber(lastKm)} km{last ? ` · ${formatDateShort(last.date)}` : ''}
        </T>
        {delta > 0 && days ? (
          <T variant="meta" color={Colors.accent}>
            +{formatNumber(delta)} km over {days} day{days === 1 ? '' : 's'}
          </T>
        ) : null}
      </View>
      <Rule />
      <View style={styles.section}>
        <T variant="section">Read on</T>
        <View style={styles.chips}>
          <Chip label="Today" selected={date === todayIso()} onPress={() => setDate(todayIso())} />
          <Chip label="Yesterday" selected={date === isoDaysAgo(1)} onPress={() => setDate(isoDaysAgo(1))} />
          <Chip label={date !== todayIso() && date !== isoDaysAgo(1) ? formatDateLong(date) : 'Pick a date'} selected={date !== todayIso() && date !== isoDaysAgo(1)} onPress={() => setPicking(true)} />
        </View>
        <T variant="meta">Date the reading when you saw it, not when you typed it.</T>
      </View>
      <Rule />
      <KeyValueRow label="Distance since" value={delta > 0 ? `${formatNumber(delta)} km` : '—'} />
      <KeyValueRow label="Daily average" value={delta > 0 && days ? `${formatNumber(delta / days)} km/day` : '—'} />
      <KeyValueRow
        label="Next service"
        value={nextService ? `${formatNumber(Math.max(0, nextService - (reading || lastKm)))} km away · at ${formatNumber(nextService)}` : 'Not set'}
      />
      <KeyValueRow
        label="Cost per km"
        value={cpkAfter ? `${currency} ${cpkAfter.toFixed(2)}${cpkBefore && cpkBefore !== cpkAfter ? ` · was ${cpkBefore.toFixed(2)}` : ''}` : '—'}
        last
      />
      <View style={styles.section}>
        <T variant="section">What this does</T>
        <T variant="body" color={Colors.ink}>
          It moves your distance-based reminders and refreshes cost per km. It does not create an expense.
        </T>
      </View>
      <DateSheet visible={picking} value={date} onSelect={setDate} onClose={() => setPicking(false)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  figure: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingTop: Spacing.lg,
  },
  input: {
    fontFamily: FontFamily.medium,
    fontSize: 48,
    letterSpacing: -1,
    color: Colors.accent,
    minWidth: 120,
    paddingVertical: 0,
  },
  unit: {
    fontSize: 13,
    color: Colors.slate,
    marginBottom: 10,
  },
  lastRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.lg,
  },
  section: {
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
});
