import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { DateSheet } from '@/components/ui/DateSheet';
import { IconGlyph } from '@/components/ui/IconGlyph';
import { PlaceSheet } from '@/components/ui/PlaceSheet';
import { Screen } from '@/components/ui/Screen';
import { SelectSheet } from '@/components/ui/SelectSheet';
import { T } from '@/components/ui/Typography';
import { TopBar } from '@/components/ui/TopBar';
import { useAccount, useRecords } from '@/data/hooks';
import { setDraft } from '@/features/assistant/draftStore';
import { findCategoryByKey, findCategoryByLabel } from '@/features/record/categories';
import {
  fieldGlyph,
  formSpecFor,
  groupOf,
  OPTION_GLYPH,
  PAST_DATES,
  placeKindOf,
  RECORD_DATE_FIELDS,
  TITLE_FIELD,
  type FormField,
  type FormGroup,
  type ReminderContext,
} from '@/features/record/formSpec';
import { useResolvedVehicle } from '@/features/record/useResolvedVehicle';
import { formatNumber, todayIso } from '@/lib/format';
import { Colors, FontFamily, Spacing } from '@/theme/tokens';
import { REGION_UNITS } from '@/types/domain';

const MON3 = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** Design date format: "09 Sep 2026". */
function showDate(iso: string) {
  const [y, m, d] = iso.split('-');
  return `${d} ${MON3[Number(m) - 1]} ${y}`;
}

const parseNum = (s: string | undefined) => {
  if (!s) return undefined;
  const n = Number(s.replace(/[,\s]/g, ''));
  return s.trim() && !Number.isNaN(n) ? n : undefined;
};

const ORDER: FormGroup[] = ['Cost', 'Details', 'Where', 'Odometer', 'When'];
const FIELD_LINE = 'rgba(20,22,26,0.14)';
const MUTED = '#8A847D';

/**
 * One form for every cost in the record selector (design screens r_fuel ...
 * r_else). Fields, placeholders, icons and reminders come from the design's
 * REC list (features/record/formSpec.ts). Amount first, then Cost, Details,
 * Where, Odometer and When. Places open the place sheet, dates the date
 * sheet, choices the select sheet. Nothing is written until Save on
 * "What will change".
 */
export default function RecordFormScreen() {
  const { vehicleId, categoryKey, categoryLabel } = useLocalSearchParams<{ vehicleId?: string; categoryKey?: string; categoryLabel?: string }>();
  const category = findCategoryByKey(categoryKey) ?? findCategoryByLabel(categoryLabel);
  const spec = formSpecFor(category.key);
  const vehicle = useResolvedVehicle(vehicleId);
  const account = useAccount().data;
  const records = useRecords(vehicle?.id).data;
  const currency = account ? (REGION_UNITS[account.region]?.currency ?? 'KES') : 'KES';

  const [values, setValues] = useState<Record<string, string>>({});
  const [extra, setExtra] = useState<string[]>([]);
  const [remind, setRemind] = useState(false);
  const [sheet, setSheet] = useState<{ kind: 'date' | 'place' | 'select'; field: FormField } | null>(null);
  const set = (k: string, v: string) => setValues((prev) => ({ ...prev, [k]: v }));

  const recentPlaces = useMemo(() => {
    const seen = new Set<string>();
    for (const r of records ?? []) if (r.place && !seen.has(r.place)) seen.add(r.place);
    return [...seen];
  }, [records]);

  // Fuel: litres × price per litre fills the total when the total is left blank.
  const amount = (() => {
    const typed = parseNum(values.$amount);
    if (typed !== undefined) return typed;
    if (spec.designKey === 'fuel') {
      const l = parseNum(values.litres);
      const p = parseNum(values.ppl);
      if (l && p) return Math.round(l * p * 100) / 100;
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

  const odometer = parseNum(values.odo);
  const recordDate = RECORD_DATE_FIELDS.map((k) => values[k]).find(Boolean) ?? todayIso();
  const ctx: ReminderContext = { values, date: recordDate, odometer, nextServiceDueKm: vehicle.nextServiceDueKm, vehicleName: vehicle.model };
  const remindNeeds = spec.remind?.needs ? spec.fields.find((f) => f.k === spec.remind!.needs) : undefined;
  const remindReady = !remindNeeds || !!values[remindNeeds.k];
  const canSave = !!amount && amount > 0;

  const review = () => {
    const titleKey = TITLE_FIELD[category.key];
    const placeField = spec.fields.find((f) => f.kind === 'place');
    const dateKey = RECORD_DATE_FIELDS.find((k) => spec.fields.some((f) => f.k === k));
    const used = new Set(['odo', 'litres', titleKey, placeField?.k, dateKey].filter(Boolean) as string[]);
    const work = [values.work, ...extra].map((x) => x?.trim()).filter(Boolean).join(' · ');
    const title = titleKey === 'work' ? work : values[titleKey ?? '']?.trim();
    const reminder = remind && spec.remind && remindReady ? spec.remind.build(ctx) : null;

    setDraft({
      kind: category.type ?? (category.key === 'fuel' ? 'fuel' : category.key === 'service' ? 'service' : 'expense'),
      category: category.category ?? (category.key === 'fuel' ? 'fuel' : category.key === 'service' ? 'service' : 'other'),
      categoryKey: category.key,
      amount,
      litres: parseNum(values.litres),
      odometer,
      place: placeField ? values[placeField.k]?.trim() || undefined : undefined,
      title: title || undefined,
      details: spec.fields
        .filter((f) => !used.has(f.k))
        .map((f) => ({ label: f.label, value: f.kind === 'date' && values[f.k] ? showDate(values[f.k]) : (values[f.k] ?? '') })),
      reminder: reminder ? { ...reminder, hint: spec.remind!.hint(ctx) } : undefined,
      vehicleId: vehicle.id,
      date: recordDate,
      origin: 'form',
      sources: { kind: 'You chose this', vehicle: 'The vehicle you were adding to', amount: 'Entered by you', litres: 'Entered by you', odometer: 'Entered by you', place: 'Entered by you' },
    });
    router.push('/record/review');
  };

  // Typed fields are a plain row (a disabled Pressable would disable the input on web); sheet fields are pressable.
  const box = (f: FormField, inner: ReactNode, onPress?: () => void, trailing?: string) => {
    const icon = <IconGlyph glyph={f.kind === 'place' ? 'f-location' : f.kind === 'date' ? 'f-calendar' : fieldGlyph(f)} size={20} bg="transparent" scale={0.9} />;
    const tail = trailing ? <IconGlyph glyph={trailing} size={18} bg="transparent" fg={MUTED} scale={0.9} /> : null;
    if (!onPress) {
      return (
        <View style={styles.box}>
          {icon}
          {inner}
        </View>
      );
    }
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [styles.box, pressed && { backgroundColor: '#F7F9FC' }]}>
        {icon}
        {inner}
        {tail}
      </Pressable>
    );
  };

  const renderField = (f: FormField) => {
    const value = values[f.k] ?? '';
    let body: ReactNode;
    if (f.kind === 'text' || f.kind === 'num') {
      body = box(
        f,
        <>
          <TextInput
            value={value}
            onChangeText={(t) => set(f.k, t)}
            placeholder={f.k === 'odo' && vehicle.odometerKm ? formatNumber(vehicle.odometerKm) : f.ph}
            placeholderTextColor={MUTED}
            keyboardType={f.kind === 'num' && f.k !== 'num' ? (f.k === 'odo' || f.k === 'qty' ? 'number-pad' : 'decimal-pad') : 'default'}
            autoCapitalize={f.kind === 'text' ? 'sentences' : 'none'}
            style={styles.input}
          />
          {f.suffix ? <T style={styles.unit}>{f.suffix.toUpperCase()}</T> : null}
        </>
      );
    } else if (f.kind === 'area' && f.k === 'work') {
      // Work performed: "Add another item" adds a line; every line but the first can be removed.
      body = (
        <View style={styles.lines}>
          {box(f, <TextInput value={value} onChangeText={(t) => set(f.k, t)} placeholder={f.ph} placeholderTextColor={MUTED} style={styles.input} />)}
          {extra.map((line, i) => (
            <View key={i} style={[styles.box, styles.lineBox]}>
              <IconGlyph glyph={fieldGlyph(f)} size={20} bg="transparent" scale={0.9} />
              <TextInput
                value={line}
                onChangeText={(t) => setExtra((prev) => prev.map((x, j) => (j === i ? t : x)))}
                placeholder="Another item"
                placeholderTextColor={MUTED}
                autoFocus={!line && i === extra.length - 1}
                style={styles.input}
              />
              <Pressable onPress={() => setExtra((prev) => prev.filter((_, j) => j !== i))} hitSlop={6} style={styles.remove} accessibilityLabel="Remove this item">
                <IconGlyph glyph="close" size={40} bg="transparent" fg={MUTED} scale={0.42} />
              </Pressable>
            </View>
          ))}
          <Pressable onPress={() => setExtra((prev) => [...prev, ''])} style={({ pressed }) => [styles.addLine, pressed && { backgroundColor: '#E1EBF7' }]}>
            <IconGlyph glyph="add" size={18} bg="transparent" scale={0.95} />
            <T style={styles.addLineText}>Add another item</T>
          </Pressable>
        </View>
      );
    } else if (f.kind === 'area') {
      body = (
        <View style={[styles.box, styles.areaBox]}>
          <IconGlyph glyph={fieldGlyph(f)} size={20} bg="transparent" scale={0.9} />
          <TextInput value={value} onChangeText={(t) => set(f.k, t)} placeholder={f.ph} placeholderTextColor={MUTED} multiline style={[styles.input, styles.area]} />
        </View>
      );
    } else if (f.kind === 'place') {
      body = box(
        f,
        <T style={[styles.shown, { color: value ? '#333333' : MUTED }]} numberOfLines={1}>
          {value || f.ph || 'Search Google Maps'}
        </T>,
        () => setSheet({ kind: 'place', field: f }),
        'search'
      );
    } else if (f.kind === 'date') {
      body = box(
        f,
        <T style={[styles.shown, { color: value ? '#333333' : MUTED }]} numberOfLines={1}>
          {value ? showDate(value) : f.ph || 'Pick a date'}
        </T>,
        () => setSheet({ kind: 'date', field: f }),
        'arrow-right'
      );
    } else {
      body = box(
        f,
        <T style={[styles.shown, { color: value ? '#333333' : MUTED }]} numberOfLines={1}>
          {value || `Choose ${f.label.toLowerCase()}`}
        </T>,
        () => setSheet({ kind: 'select', field: f }),
        'chevron-down'
      );
    }
    return (
      <View key={f.k}>
        <T style={styles.label}>{f.label}</T>
        {body}
      </View>
    );
  };

  const groups = ORDER.map((name) => ({ name, fields: spec.fields.filter((f) => groupOf(f) === name) })).filter((g) => g.fields.length || g.name === 'Cost');

  return (
    <Screen
      header={<TopBar backLabel="BACK" right={category.label.toUpperCase()} />}
      footer={
        <Button disabled={!canSave} onPress={review} glyph={canSave ? 'check' : undefined}>
          {canSave ? 'Save expense' : 'Enter the amount'}
        </Button>
      }>
      <View style={styles.head}>
        <View style={styles.helper}>
          <IconGlyph glyph={spec.glyph} size={18} bg="transparent" scale={0.95} />
          <T style={styles.helperText} numberOfLines={1}>
            {spec.helper}
          </T>
        </View>
        <T variant="display">
          {category.label} for the {vehicle.model}
        </T>
      </View>

      {groups.map((g, i) => (
        <View key={g.name} style={[styles.group, i > 0 && styles.groupRule]}>
          <T style={styles.groupName}>{g.name}</T>
          <View style={styles.fields}>
            {g.name === 'Cost' ? (
              <View>
                <T style={styles.label}>{spec.amount}</T>
                <View style={[styles.box, styles.amountBox]}>
                  <IconGlyph glyph="f-cash" size={20} bg="transparent" scale={0.9} />
                  <T style={styles.unit}>{currency}</T>
                  <TextInput
                    value={values.$amount ?? (spec.designKey === 'fuel' && amount !== undefined ? String(amount) : '')}
                    onChangeText={(t) => set('$amount', t)}
                    placeholder="0"
                    placeholderTextColor={MUTED}
                    keyboardType="decimal-pad"
                    style={[styles.input, styles.amountInput]}
                  />
                </View>
              </View>
            ) : null}
            {g.fields.map(renderField)}
          </View>
        </View>
      ))}

      {spec.remind ? (
        <Pressable onPress={() => remindReady && setRemind((r) => !r)} style={styles.remind}>
          <View style={styles.flex}>
            <T style={styles.remindLabel}>{spec.remind.label}</T>
            <T style={styles.remindHint}>
              {remindReady ? spec.remind.hint(ctx) : `Add the ${remindNeeds!.label.toLowerCase()} above to set this.`}
            </T>
          </View>
          <View style={[styles.switch, { backgroundColor: remind && remindReady ? '#F8C01D' : '#DAD7D1' }]}>
            <View style={[styles.knob, { left: remind && remindReady ? 20 : 2 }]} />
          </View>
        </Pressable>
      ) : null}
      <T style={styles.foot}>Anything left blank stays blank. Nothing is written until you save, and a saved record can be corrected later.</T>

      <DateSheet
        visible={sheet?.kind === 'date'}
        value={sheet?.kind === 'date' ? (values[sheet.field.k] ?? '') : ''}
        allowFuture={sheet?.kind === 'date' && !PAST_DATES.has(sheet.field.k)}
        onSelect={(d) => sheet && set(sheet.field.k, d)}
        onClear={() => sheet && set(sheet.field.k, '')}
        onClose={() => setSheet(null)}
      />
      <PlaceSheet
        visible={sheet?.kind === 'place'}
        title={sheet?.field.label ?? ''}
        kind={sheet?.kind === 'place' ? placeKindOf(sheet.field.k, spec) : undefined}
        recent={recentPlaces}
        onSelect={(name) => sheet && set(sheet.field.k, name)}
        onClose={() => setSheet(null)}
      />
      <SelectSheet
        visible={sheet?.kind === 'select'}
        title={sheet?.field.label ?? ''}
        glyph={sheet ? fieldGlyph(sheet.field) : undefined}
        options={(sheet?.kind === 'select' ? (sheet.field.opts ?? []) : []).map((o) => ({ label: o, glyph: OPTION_GLYPH[o] }))}
        value={sheet ? values[sheet.field.k] : undefined}
        onSelect={(o) => sheet && set(sheet.field.k, o)}
        onClose={() => setSheet(null)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  head: {
    paddingTop: Spacing.lg,
    gap: 14,
  },
  helper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  helperText: {
    fontFamily: FontFamily.regular,
    fontSize: 10,
    letterSpacing: 1,
    color: Colors.slate,
  },
  group: {
    marginTop: 22,
  },
  groupRule: {
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(19,75,156,0.18)',
    marginHorizontal: -Spacing.lg,
    paddingHorizontal: Spacing.lg,
  },
  groupName: {
    fontFamily: FontFamily.medium,
    fontSize: 13,
    letterSpacing: 0.26,
    color: Colors.accent,
  },
  fields: {
    gap: 14,
    marginTop: 14,
  },
  label: {
    fontFamily: FontFamily.regular,
    fontSize: 13,
    color: '#5F5A55',
  },
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    minHeight: 56,
    marginTop: 9,
    paddingHorizontal: 16,
    borderRadius: 18,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: FIELD_LINE,
  },
  amountBox: {
    backgroundColor: '#F7F9FC',
    borderColor: 'rgba(19,75,156,0.18)',
  },
  amountInput: {
    fontFamily: FontFamily.medium,
  },
  areaBox: {
    alignItems: 'flex-start',
    paddingVertical: 16,
  },
  area: {
    minHeight: 44,
    textAlignVertical: 'top',
  },
  input: {
    flex: 1,
    minWidth: 0,
    fontFamily: FontFamily.regular,
    fontSize: 14,
    color: '#333333',
    paddingVertical: 0,
  },
  shown: {
    flex: 1,
    minWidth: 0,
    fontFamily: FontFamily.regular,
    fontSize: 14,
  },
  unit: {
    fontFamily: FontFamily.regular,
    fontSize: 10,
    letterSpacing: 1.2,
    color: Colors.slate,
  },
  lines: {
    gap: 8,
  },
  lineBox: {
    marginTop: 0,
    paddingRight: 8,
  },
  remove: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addLine: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 44,
    paddingLeft: 13,
    paddingRight: 16,
    borderRadius: 999,
    backgroundColor: Colors.accentSoft,
  },
  addLineText: {
    fontFamily: FontFamily.medium,
    fontSize: 14,
    color: Colors.accent,
  },
  remind: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    marginTop: 20,
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderRadius: 20,
    backgroundColor: '#F7F9FC',
  },
  remindLabel: {
    fontFamily: FontFamily.medium,
    fontSize: 14,
    color: Colors.ink,
  },
  remindHint: {
    fontFamily: FontFamily.regular,
    fontSize: 13,
    lineHeight: 19,
    color: '#5F5A55',
    marginTop: 5,
  },
  switch: {
    width: 44,
    height: 26,
    borderRadius: 999,
  },
  knob: {
    position: 'absolute',
    top: 2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.white,
    shadowColor: '#14161A',
    shadowOpacity: 0.24,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  foot: {
    fontFamily: FontFamily.regular,
    fontSize: 13,
    lineHeight: 19,
    color: Colors.slate,
    marginTop: 24,
    marginBottom: Spacing.md,
    maxWidth: 300,
  },
});
