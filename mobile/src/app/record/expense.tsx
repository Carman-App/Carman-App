import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Rule } from '@/components/ui/Blocks';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { DateSheet } from '@/components/ui/DateSheet';
import { Screen } from '@/components/ui/Screen';
import { TextField } from '@/components/ui/TextField';
import { T } from '@/components/ui/Typography';
import { TopBar } from '@/components/ui/TopBar';
import { useAccount } from '@/data/hooks';
import { setDraft } from '@/features/assistant/draftStore';
import { findCategoryByKey, findCategoryByLabel } from '@/features/record/categories';
import { formSpecFor, type FormField, type FormSection } from '@/features/record/formSpec';
import { useResolvedVehicle } from '@/features/record/useResolvedVehicle';
import { formatDateLong, todayIso } from '@/lib/format';
import { Colors, Spacing } from '@/theme/tokens';
import { REGION_UNITS } from '@/types/domain';

function isoDaysAgo(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const parseNum = (s: string) => {
  const n = Number(s.replace(/[,\s]/g, ''));
  return s.trim() && !Number.isNaN(n) ? n : undefined;
};

/**
 * One form for every cost in the record selector (Fuel, Service, Repair,
 * Parts, Insurance ... Something else). Amount first, then the fields that
 * belong to that kind, then a review. Nothing is written until Save on
 * "What will change".
 */
export default function RecordFormScreen() {
  const { vehicleId, categoryKey, categoryLabel } = useLocalSearchParams<{ vehicleId?: string; categoryKey?: string; categoryLabel?: string }>();
  const category = findCategoryByKey(categoryKey) ?? findCategoryByLabel(categoryLabel);
  const spec = formSpecFor(category.key);
  const vehicle = useResolvedVehicle(vehicleId);
  const account = useAccount().data;
  const currency = account ? (REGION_UNITS[account.region]?.currency ?? 'KES') : 'KES';

  const [values, setValues] = useState<Record<string, string>>({});
  const [date, setDate] = useState(todayIso());
  const [odometer, setOdometer] = useState('');
  const [picking, setPicking] = useState(false);
  const set = (id: string, v: string) => setValues((prev) => ({ ...prev, [id]: v }));

  // Fuel: price × litres fills the total when the total is left blank.
  const computedAmount = (() => {
    const typed = parseNum(values.amount ?? '');
    if (typed !== undefined) return typed;
    if (category.key === 'fuel') {
      const p = parseNum(values.price ?? '');
      const l = parseNum(values.litres ?? '');
      if (p && l) return Math.round(p * l);
    }
    return undefined;
  })();

  if (!vehicle) {
    return (
      <Screen header={<TopBar backLabel="BACK" right={category.label.toUpperCase()} />}>
        <T variant="lede" style={{ paddingTop: Spacing.xl }}>
          Add a vehicle to your garage first, then come back to log this.
        </T>
      </Screen>
    );
  }

  const sections: FormSection[] = ['Cost', 'Details', 'Where', 'When'];
  const bySection = (s: FormSection) => spec.fields.filter((f) => f.section === s);
  const canSave = !!computedAmount && computedAmount > 0;

  const review = () => {
    const titleField = spec.fields.find((f) => f.maps === 'title');
    const placeField = spec.fields.find((f) => f.maps === 'place');
    setDraft({
      kind: category.type ?? (category.key === 'fuel' ? 'fuel' : category.key === 'service' ? 'service' : 'expense'),
      category: category.category ?? (category.key === 'fuel' ? 'fuel' : category.key === 'service' ? 'service' : 'other'),
      categoryKey: category.key,
      amount: computedAmount,
      litres: parseNum(values.litres ?? ''),
      odometer: parseNum(odometer),
      place: placeField ? values[placeField.id]?.trim() || undefined : undefined,
      title: titleField ? values[titleField.id]?.trim() || undefined : undefined,
      details: spec.fields.filter((f) => f.maps === 'detail').map((f) => ({ label: f.label, value: values[f.id] ?? '' })),
      vehicleId: vehicle.id,
      date,
      origin: 'form',
      sources: { kind: 'You chose this', amount: 'Entered by you', litres: 'Entered by you', odometer: 'Entered by you', place: 'Entered by you' },
    });
    router.push('/record/review');
  };

  const renderField = (f: FormField) => {
    if (f.kind === 'choice') {
      return (
        <View key={f.id} style={styles.choice}>
          <T variant="small" color={Colors.body}>
            {f.label}
          </T>
          <View style={styles.chips}>
            {f.options!.map((o) => (
              <Chip key={o} label={o} selected={values[f.id] === o} onPress={() => set(f.id, values[f.id] === o ? '' : o)} />
            ))}
          </View>
        </View>
      );
    }
    const isAmount = f.id === 'amount';
    return (
      <TextField
        key={f.id}
        label={f.label}
        value={values[f.id] ?? (isAmount && computedAmount !== undefined && category.key === 'fuel' ? String(computedAmount) : '')}
        onChangeText={(v) => set(f.id, v)}
        placeholder={isAmount ? '0' : f.placeholder}
        keyboardType={f.kind === 'money' || f.kind === 'number' ? 'decimal-pad' : 'default'}
        prefix={f.kind === 'money' ? currency : undefined}
        emphasis={isAmount}
        autoCapitalize={f.kind === 'text' ? 'sentences' : 'none'}
      />
    );
  };

  return (
    <Screen
      header={<TopBar backLabel="BACK" right={category.label.toUpperCase()} />}
      footer={
        <Button disabled={!canSave} onPress={review}>
          {canSave ? 'Save expense' : 'Enter the amount'}
        </Button>
      }>
      <View style={styles.head}>
        <T variant="eyebrow" color={Colors.body}>
          {spec.eyebrow}
        </T>
        <T variant="display">
          {category.label} for the {vehicle.model}
        </T>
      </View>

      {sections.map((s) => {
        const fields = bySection(s);
        const showOdo = s === 'Where' && spec.odometer;
        const showWhen = s === 'When';
        if (fields.length === 0 && !showOdo && !showWhen) return null;
        return (
          <View key={s}>
            {s !== 'Cost' ? <Rule /> : null}
            <View style={styles.section}>
              <T variant="section">{s}</T>
              {fields.map(renderField)}
              {showWhen ? (
                <View style={styles.choice}>
                  <T variant="small" color={Colors.body}>
                    Date
                  </T>
                  <View style={styles.chips}>
                    <Chip label="Today" selected={date === todayIso()} onPress={() => setDate(todayIso())} />
                    <Chip label="Yesterday" selected={date === isoDaysAgo(1)} onPress={() => setDate(isoDaysAgo(1))} />
                    <Chip label={date !== todayIso() && date !== isoDaysAgo(1) ? formatDateLong(date) : 'Pick a date'} selected={date !== todayIso() && date !== isoDaysAgo(1)} onPress={() => setPicking(true)} />
                  </View>
                </View>
              ) : null}
            </View>
            {showOdo ? (
              <>
                <Rule />
                <View style={styles.section}>
                  <T variant="section">Odometer</T>
                  <TextField
                    label="Odometer"
                    value={odometer}
                    onChangeText={setOdometer}
                    placeholder={String(vehicle.odometerKm)}
                    keyboardType="number-pad"
                    suffix="km"
                    helper="Optional. A reading moves distance reminders and cost per km."
                  />
                </View>
              </>
            ) : null}
          </View>
        );
      })}
      <DateSheet visible={picking} value={date} onSelect={setDate} onClose={() => setPicking(false)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: {
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
    gap: 10,
  },
  section: {
    paddingVertical: Spacing.md,
    gap: 14,
  },
  choice: {
    gap: Spacing.xs,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
});
