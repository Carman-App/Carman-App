import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { MoneyFigure } from '@/components/ui/Blocks';
import { Button } from '@/components/ui/Button';
import { IconGlyph } from '@/components/ui/IconGlyph';
import { OptionSheet } from '@/components/ui/OptionSheet';
import { Screen } from '@/components/ui/Screen';
import { T } from '@/components/ui/Typography';
import { TopBar } from '@/components/ui/TopBar';
import { useAccount, useActiveGarage, useVehicles } from '@/data/hooks';
import { patchDraft, setDraft, useDraft, type PendingDraft } from '@/features/assistant/draftStore';
import { draftGaps } from '@/features/assistant/saveDraft';
import { findCategoryByKey } from '@/features/record/categories';
import { formatDateLong, formatNumber } from '@/lib/format';
import { Colors, FontFamily, Radius, Spacing } from '@/theme/tokens';
import { REGION_UNITS } from '@/types/domain';

type FieldKey = 'amount' | 'odometer' | 'litres' | 'place' | 'title';

const KIND_LABEL: Record<PendingDraft['kind'], string> = {
  fuel: 'Fuel',
  service: 'Service',
  repair: 'Repair',
  part: 'Parts',
  expense: 'Expense',
  odometer: 'Odometer reading',
};

/**
 * Review. Every field says where it came from; blanks are yellow and say
 * what is needed. Tapping a value edits it in place. Nothing is saved here.
 */
export default function ReviewScreen() {
  const draft = useDraft();
  const account = useAccount().data;
  const garage = useActiveGarage().data;
  const vehicles = useVehicles(garage?.id).data ?? [];
  const [editing, setEditing] = useState<FieldKey | null>(null);
  const [buffer, setBuffer] = useState('');
  const [pickVehicle, setPickVehicle] = useState(false);
  const currency = account ? (REGION_UNITS[account.region]?.currency ?? 'KES') : 'KES';

  if (!draft) {
    return (
      <Screen header={<TopBar title="Review" right="Nothing to review" />}>
        <T variant="lede" style={styles.empty}>
          There is no draft open. Describe what happened on Home, or add a record with the +.
        </T>
      </Screen>
    );
  }

  const vehicle = vehicles.find((v) => v.id === draft.vehicleId);
  const category = findCategoryByKey(draft.categoryKey);
  const kindLabel = category?.label ?? KIND_LABEL[draft.kind];
  const gaps = draftGaps(draft);

  const startEdit = (key: FieldKey, current?: string | number) => {
    setEditing(key);
    setBuffer(current === undefined ? '' : String(current));
  };

  const commit = () => {
    if (!editing) return;
    const raw = buffer.trim();
    const numeric = Number(raw.replace(/,/g, ''));
    const src = { [editing]: 'You corrected this' };
    if (editing === 'place' || editing === 'title') patchDraft({ [editing]: raw || undefined, sources: src });
    else patchDraft({ [editing]: raw && !Number.isNaN(numeric) ? numeric : undefined, sources: src });
    setEditing(null);
  };

  const rows: { key: FieldKey | 'vehicle' | 'kind'; glyph: string; label: string; value?: string; source?: string; need: string }[] = [
    { key: 'kind', glyph: category?.glyph ?? draft.kind, label: 'Category', value: kindLabel, source: draft.sources.kind ?? 'You chose this', need: 'What kind of record' },
    { key: 'vehicle', glyph: 'vehicle', label: 'Vehicle', value: vehicle ? `${vehicle.make} ${vehicle.model}` : undefined, source: vehicle ? (draft.sources.vehicle ?? 'From the scope you picked') : undefined, need: 'Which vehicle this belongs to' },
  ];
  if (draft.title !== undefined || draft.kind === 'service' || draft.kind === 'repair') {
    rows.push({ key: 'title', glyph: 'note', label: 'Work done', value: draft.title, source: draft.sources.kind ? 'From what you said' : 'Entered by you', need: 'What was done' });
  }
  if (draft.kind === 'fuel') {
    rows.push({ key: 'litres', glyph: 'fuel', label: 'Litres', value: draft.litres !== undefined ? formatNumber(draft.litres) : undefined, source: draft.sources.litres, need: 'How many litres' });
  }
  rows.push({
    key: 'odometer',
    glyph: 'odometer',
    label: 'Odometer',
    value: draft.odometer !== undefined ? `${formatNumber(draft.odometer)} km` : undefined,
    source: draft.sources.odometer,
    need: draft.kind === 'odometer' ? 'The reading' : `Optional · last ${vehicle ? formatNumber(vehicle.odometerKm) : '—'} km`,
  });
  rows.push({ key: 'place', glyph: 'place', label: 'Where', value: draft.place, source: draft.sources.place, need: 'Optional · station, workshop or shop' });

  const subtitle = [kindLabel, vehicle?.model, draft.place].filter(Boolean).join(' · ');

  return (
    <Screen
      padded={false}
      header={<TopBar title="Review" right="Nothing saved yet" />}
      headerRule
      footer={
        <>
          <Button disabled={gaps.length > 0} onPress={() => router.push('/record/changes')}>
            {gaps.length > 0 ? `Add the ${gaps[0]} first` : draft.kind === 'odometer' ? 'Save reading' : 'Save expense'}
          </Button>
          <View style={styles.footRow}>
            <Pressable accessibilityRole="button"
              hitSlop={8}
              onPress={() => {
                setDraft(null);
                router.back();
              }}>
              <T variant="meta" color={Colors.body}>
                Discard
              </T>
            </Pressable>
            <Pressable accessibilityRole="button" hitSlop={8} onPress={() => router.push('/record/changes')} disabled={gaps.length > 0}>
              <T variant="meta" color={gaps.length > 0 ? Colors.textFaint : Colors.body}>
                See what will change
              </T>
            </Pressable>
          </View>
        </>
      }>
      <View style={styles.head}>
        <T variant="meta">{subtitle}</T>
        {draft.kind === 'odometer' ? (
          <MoneyFigure currency="KM" amount={draft.odometer ? formatNumber(draft.odometer) : '—'} />
        ) : (
          <Pressable accessibilityRole="button" onPress={() => startEdit('amount', draft.amount)}>
            {editing === 'amount' ? (
              <TextInput value={buffer} onChangeText={setBuffer} onBlur={commit} onSubmitEditing={commit} autoFocus keyboardType="decimal-pad" style={styles.amountInput} />
            ) : (
              <MoneyFigure currency={currency} amount={draft.amount ? formatNumber(draft.amount) : '0'} color={draft.amount ? Colors.ink : Colors.textFaint} />
            )}
          </Pressable>
        )}
        <T variant="meta">{formatDateLong(draft.date)}</T>
      </View>

      {rows.map((r) => {
        const blank = !r.value;
        const isEditing = editing === r.key;
        return (
          <Pressable accessibilityRole="button"
            key={r.key}
            onPress={() => {
              if (r.key === 'vehicle') setPickVehicle(true);
              else if (r.key !== 'kind') startEdit(r.key, r.key === 'odometer' ? draft.odometer : r.key === 'litres' ? draft.litres : r.key === 'place' ? draft.place : draft.title);
            }}
            style={[styles.row, blank && r.key !== 'place' && r.key !== 'odometer' && styles.rowBlank]}>
            <IconGlyph glyph={r.glyph} size={36} shape="tile" bg={blank ? Colors.white : Colors.accentSoft} />
            <T variant="meta" style={styles.rowLabel}>
              {r.label}
            </T>
            <View style={styles.rowValue}>
              {isEditing ? (
                <TextInput
                  value={buffer}
                  onChangeText={setBuffer}
                  onBlur={commit}
                  onSubmitEditing={commit}
                  autoFocus
                  keyboardType={r.key === 'odometer' || r.key === 'litres' ? 'decimal-pad' : 'default'}
                  style={styles.inlineInput}
                />
              ) : (
                <T variant="body" color={blank ? Colors.textMuted : Colors.ink}>
                  {r.value ?? 'Tap to add'}
                </T>
              )}
              <T variant="small">{blank ? r.need : r.source}</T>
            </View>
          </Pressable>
        );
      })}

      <OptionSheet
        visible={pickVehicle}
        title="Which vehicle?"
        options={vehicles.map((v) => ({ key: v.id, label: `${v.make} ${v.model}`, meta: `${v.year} · ${formatNumber(v.odometerKm)} KM`, glyph: v.type === 'motorcycle' ? 'motorcycle' : 'vehicle' }))}
        selected={draft.vehicleId}
        onSelect={(id) => {
          patchDraft({ vehicleId: id, sources: { vehicle: 'You picked this' } });
          setPickVehicle(false);
        }}
        onClose={() => setPickVehicle(false)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  empty: {
    paddingTop: Spacing.xl,
  },
  head: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.lg,
    gap: 6,
  },
  amountInput: {
    outlineWidth: 0,
    fontFamily: FontFamily.bold,
    fontSize: 40,
    color: Colors.ink,
    borderBottomWidth: 1,
    borderBottomColor: Colors.accent,
    paddingVertical: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.borderSoft,
  },
  rowBlank: {
    backgroundColor: Colors.ctaSoft,
  },
  rowLabel: {
    width: 76,
    paddingTop: 8,
    color: Colors.textMuted,
  },
  rowValue: {
    flex: 1,
    gap: 6,
    paddingTop: 7,
  },
  inlineInput: {
    outlineWidth: 0,
    fontFamily: FontFamily.medium,
    fontSize: 14,
    color: Colors.ink,
    borderWidth: 1,
    borderColor: Colors.accent,
    borderRadius: Radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  footRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
});
