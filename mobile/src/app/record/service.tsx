import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { ModalHeader } from '@/components/ui/ModalHeader';
import { Screen } from '@/components/ui/Screen';
import { TextField } from '@/components/ui/TextField';
import { T } from '@/components/ui/Typography';
import { useAccount } from '@/data/hooks';
import { addRecord, updateVehicle } from '@/data/repo';
import { DateQuickPick } from '@/features/record/DateQuickPick';
import { OdometerQuickAdd } from '@/features/record/OdometerQuickAdd';
import { useResolvedVehicle } from '@/features/record/useResolvedVehicle';
import { formatDateWithYear, formatDistance, formatMoney, getActiveCurrency, getActiveDistanceUnit, todayIso } from '@/lib/format';
import { Colors, Radius, Spacing } from '@/theme/tokens';

type LineKind = 'FLUID' | 'PART' | 'LABOUR';
type LineItem = { id: string; name: string; kind: LineKind; cost: string };

const KIND_CYCLE: LineKind[] = ['FLUID', 'PART', 'LABOUR'];
const NEXT_SERVICE_OPTIONS = [5000, 10000] as const;

let lineSeq = 0;
function newLineId() {
  lineSeq += 1;
  return `line-${Date.now()}-${lineSeq}`;
}

export default function ServiceEntryScreen() {
  const { vehicleId } = useLocalSearchParams<{ vehicleId?: string }>();
  const vehicle = useResolvedVehicle(vehicleId);
  const account = useAccount().data;

  const [lines, setLines] = useState<LineItem[]>(() => [
    { id: newLineId(), name: 'Engine oil · 5W-30 fully synthetic', kind: 'FLUID', cost: '7000' },
    { id: newLineId(), name: 'Oil filter', kind: 'PART', cost: '1500' },
    { id: newLineId(), name: 'Air filter', kind: 'PART', cost: '2000' },
    { id: newLineId(), name: 'Brake fluid', kind: 'FLUID', cost: '2500' },
    { id: newLineId(), name: 'Labour · 2.5 hrs', kind: 'LABOUR', cost: '5500' },
  ]);
  const [date, setDate] = useState(todayIso());
  const [odometer, setOdometer] = useState(String(vehicle?.odometerKm ?? 0));
  const [attached, setAttached] = useState(false);
  const [nextServiceKm, setNextServiceKm] = useState<number | null>(NEXT_SERVICE_OPTIONS[0]);
  const [customNext, setCustomNext] = useState('');
  const [showCustomNext, setShowCustomNext] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const total = useMemo(() => lines.reduce((sum, l) => sum + (Number(l.cost) || 0), 0), [lines]);

  const updateLine = (id: string, patch: Partial<LineItem>) => {
    setLines((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  };
  const cycleKind = (id: string) => {
    setLines((prev) =>
      prev.map((l) => (l.id === id ? { ...l, kind: KIND_CYCLE[(KIND_CYCLE.indexOf(l.kind) + 1) % KIND_CYCLE.length] } : l))
    );
  };
  const addLine = () => setLines((prev) => [...prev, { id: newLineId(), name: '', kind: 'PART', cost: '' }]);
  const removeLine = (id: string) => setLines((prev) => (prev.length > 1 ? prev.filter((l) => l.id !== id) : prev));

  const canSave = !!vehicle && lines.some((l) => l.name.trim() && Number(l.cost) > 0);

  const handleSave = async () => {
    if (!vehicle) return;
    setSaving(true);
    setError(null);
    try {
      const odometerNum = Number(odometer) || vehicle.odometerKm;
      const summary = lines
        .filter((l) => l.name.trim())
        .map((l) => `${l.name.trim()} (${l.kind.toLowerCase()}, ${formatMoney(Number(l.cost) || 0)})`)
        .join('; ');
      await addRecord(vehicle.id, {
        type: 'service',
        date,
        amount: total,
        odometerAtEntry: odometerNum,
        enteredByMemberName: account?.name ?? 'You',
        category: 'service',
        notes: summary,
      });
      if (nextServiceKm) {
        await updateVehicle(vehicle.id, { nextServiceDueKm: odometerNum + nextServiceKm });
      }
      router.replace({
        pathname: '/record/saved',
        params: { vehicleId: vehicle.id, amount: String(total), kind: 'service' },
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
        <ModalHeader eyebrow="SERVICE RECORD" title="No vehicle yet" />
        <T variant="body" color={Colors.textMuted}>
          Add a vehicle first to log a service.
        </T>
      </Screen>
    );
  }

  const odometerNum = Number(odometer) || 0;

  return (
    <Screen
      footer={
        <Button disabled={!canSave} loading={saving} onPress={handleSave}>
          Save service
        </Button>
      }>
      <ModalHeader eyebrow="SERVICE RECORD" title={`${vehicle.make} ${vehicle.model}`} />
      <T variant="display">{formatDistance(odometerNum)} service</T>
      <T variant="eyebrow" style={styles.subheader}>
        {formatDateWithYear(date)} · {formatDistance(odometerNum)} · {lines.length} ITEM{lines.length === 1 ? '' : 'S'}
      </T>

      <View style={styles.lines}>
        {lines.map((line) => (
          <Card key={line.id} style={styles.lineCard}>
            <View style={styles.lineTop}>
              <View style={styles.lineName}>
                <TextField value={line.name} onChangeText={(v) => updateLine(line.id, { name: v })} placeholder="Line item name" />
              </View>
              <Pressable onPress={() => removeLine(line.id)} hitSlop={8}>
                <T variant="eyebrowStrong" color={Colors.textFaint}>
                  ✕
                </T>
              </Pressable>
            </View>
            <View style={styles.lineBottom}>
              <Pressable style={styles.kindTag} onPress={() => cycleKind(line.id)}>
                <T variant="eyebrowStrong" color={Colors.accent}>
                  {line.kind}
                </T>
              </Pressable>
              <View style={styles.lineCost}>
                <TextField value={line.cost} onChangeText={(v) => updateLine(line.id, { cost: v.replace(/[^\d.]/g, '') })} keyboardType="decimal-pad" prefix={getActiveCurrency()} placeholder="0" />
              </View>
            </View>
          </Card>
        ))}
        <Pressable style={styles.addLine} onPress={addLine}>
          <T variant="bodyStrong" color={Colors.accent}>
            + Add line item
          </T>
        </Pressable>
      </View>

      <View style={styles.totalRow}>
        <T variant="eyebrow">TOTAL</T>
        <T variant="numeric">{formatMoney(total)}</T>
      </View>

      <View style={styles.form}>
        <View>
          <T variant="eyebrow">DATE</T>
          <View style={styles.dateWrap}>
            <DateQuickPick value={date} onChange={setDate} onOpenPicker={() => router.push('/record/pick-date')} />
          </View>
        </View>

        <View>
          <TextField label="ODOMETER NOW" value={odometer} onChangeText={(v) => setOdometer(v.replace(/\D/g, ''))} keyboardType="number-pad" prefix="KM" />
          <OdometerQuickAdd value={odometerNum} original={vehicle.odometerKm} onChange={(next) => setOdometer(String(next))} />
        </View>

        <View>
          <T variant="eyebrow" style={styles.label}>
            NEXT SERVICE IN
          </T>
          {nextServiceKm ? (
            <T variant="meta" style={styles.dueHint}>
              DUE AT {formatDistance(odometerNum + nextServiceKm)}
            </T>
          ) : null}
          <View style={styles.chipsRow}>
            {NEXT_SERVICE_OPTIONS.map((opt) => (
              <Chip
                key={opt}
                label={`${formatDistance(opt, { withUnit: false })} ${getActiveDistanceUnit()}`}
                selected={nextServiceKm === opt && !showCustomNext}
                onPress={() => {
                  setNextServiceKm(opt);
                  setShowCustomNext(false);
                }}
              />
            ))}
            <Chip label="Enter a different one" selected={showCustomNext} onPress={() => setShowCustomNext(true)} />
          </View>
          {showCustomNext ? (
            <View style={styles.customNext}>
              <TextField
                value={customNext}
                onChangeText={(v) => {
                  const digits = v.replace(/\D/g, '');
                  setCustomNext(digits);
                  setNextServiceKm(Number(digits) || null);
                }}
                keyboardType="number-pad"
                placeholder="km from now"
                prefix="KM"
              />
            </View>
          ) : null}
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
          <T variant="eyebrow">SOURCE</T>
          <T variant="bodyStrong" style={styles.source}>
            OWNER ENTERED
          </T>
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
  subheader: {
    marginTop: Spacing.xs,
    marginBottom: Spacing.md,
  },
  lines: {
    gap: Spacing.sm,
  },
  lineCard: {
    gap: Spacing.sm,
  },
  lineTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  lineName: {
    flex: 1,
  },
  lineBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  kindTag: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: Radius.pill,
    backgroundColor: Colors.accentSoft,
  },
  lineCost: {
    flex: 1,
  },
  addLine: {
    paddingVertical: Spacing.sm,
    alignItems: 'center',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    marginVertical: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  form: {
    gap: Spacing.lg,
  },
  dateWrap: {
    marginTop: 2,
  },
  label: {
    marginBottom: Spacing.xs,
  },
  dueHint: {
    marginBottom: Spacing.xs,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  customNext: {
    marginTop: Spacing.sm,
  },
  attachBtn: {
    alignSelf: 'flex-start',
  },
  source: {
    marginTop: 2,
  },
});
