import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Rule } from '@/components/ui/Blocks';
import { Button } from '@/components/ui/Button';
import { IconGlyph } from '@/components/ui/IconGlyph';
import { Screen } from '@/components/ui/Screen';
import { T } from '@/components/ui/Typography';
import { TopBar } from '@/components/ui/TopBar';
import { useAccount, useRecords, useVehicle } from '@/data/hooks';
import { setDraft, useDraft } from '@/features/assistant/draftStore';
import { draftToRecord, saveDraft } from '@/features/assistant/saveDraft';
import { findCategoryByKey } from '@/features/record/categories';
import { formatNumber } from '@/lib/format';
import { costPerKm, periodRecords, sumAmount } from '@/lib/spend';
import { Colors, FontFamily, Spacing } from '@/theme/tokens';
import { REGION_UNITS, type VehicleRecord } from '@/types/domain';

/**
 * What will change. The consequence, not the record: what moves, and a
 * plain list of what will not happen. "Make these changes" is the only
 * write in the whole draft flow.
 */
export default function ChangesScreen() {
  const draft = useDraft();
  const account = useAccount().data;
  const vehicle = useVehicle(draft?.vehicleId).data;
  const records = useRecords(draft?.vehicleId).data ?? [];
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const currency = account ? (REGION_UNITS[account.region]?.currency ?? 'KES') : 'KES';

  if (!draft || !vehicle) {
    return (
      <Screen header={<TopBar title="What will change" />}>
        <T variant="lede" style={{ paddingTop: Spacing.xl }}>
          Nothing is waiting to be saved.
        </T>
      </Screen>
    );
  }

  const record = draftToRecord(draft, vehicle, account?.name ?? 'You');
  const after = [...records, { ...record, id: 'draft', vehicleId: vehicle.id } as VehicleRecord];
  const yearBefore = sumAmount(periodRecords(records, 'year'));
  const yearAfter = sumAmount(periodRecords(after, 'year'));
  const cpkBefore = costPerKm(records);
  const cpkAfter = costPerKm(after);
  const odoMoves = record.odometerAtEntry > vehicle.odometerKm;
  const category = findCategoryByKey(draft.categoryKey);
  const isReading = draft.kind === 'odometer';

  const items: { glyph: string; title: string; body: string; rows?: [string, string][] }[] = [];
  if (!isReading) {
    items.push({
      glyph: 'add',
      title: `New ${category?.label.toLowerCase() ?? draft.kind}`,
      body: `${currency} ${formatNumber(record.amount)} → ${vehicle.model}`,
      rows: [
        ...(record.place ? ([['Where', record.place]] as [string, string][]) : []),
        ...(draft.details ?? []).filter((d) => d.value.trim()).map((d) => [d.label, d.value] as [string, string]),
        ['Entered by', record.enteredByMemberName],
      ],
    });
  }
  if (draft.reminder) {
    items.push({ glyph: 'reminder', title: 'Reminder set', body: draft.reminder.hint });
  }
  if (odoMoves) {
    items.push({ glyph: 'send', title: 'Odometer moves', body: `${formatNumber(vehicle.odometerKm)} → ${formatNumber(record.odometerAtEntry)} km` });
    items.push({ glyph: 'reminder', title: 'Distance reminders move', body: 'Anything due by kilometre is measured from the new reading.' });
  } else if (isReading) {
    items.push({ glyph: 'odometer', title: 'Reading recorded', body: `${formatNumber(record.odometerAtEntry)} km on ${record.date}` });
  }

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await saveDraft(draft, vehicle, account?.name ?? 'You');
      setDraft(null);
      router.replace({ pathname: '/record/saved', params: { vehicleId: vehicle.id, amount: String(record.amount), kind: draft.kind } });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save. Try again.');
      setSaving(false);
    }
  };

  return (
    <Screen
      header={<TopBar title="What will change" right={`${items.length} change${items.length === 1 ? '' : 's'}`} />}
      headerRule
      footer={
        <>
          {error ? (
            <T variant="meta" color={Colors.danger} center>
              {error}
            </T>
          ) : null}
          <Button loading={saving} onPress={save}>
            Make these changes
          </Button>
        </>
      }>
      {items.map((it) => (
        <View key={it.title} style={styles.item}>
          <IconGlyph glyph={it.glyph} size={30} bg={Colors.accentSoft} fg={Colors.accent} scale={0.55} />
          <View style={styles.itemText}>
            <T variant="section">{it.title}</T>
            <T variant="body" color={Colors.ink}>
              {it.body}
            </T>
            {it.rows?.map(([k, v]) => (
              <View key={k} style={styles.sub}>
                <T variant="meta" style={styles.subKey}>
                  {k}
                </T>
                <T variant="body" style={styles.subVal}>
                  {v}
                </T>
              </View>
            ))}
          </View>
        </View>
      ))}

      {!isReading ? (
        <View style={styles.totals}>
          <T variant="section">And the totals move</T>
          <T variant="meta">Spent {new Date().getFullYear()} · {currency}</T>
          <View style={styles.move}>
            <T style={styles.was}>{formatNumber(yearBefore)}</T>
            <T style={styles.now}>{formatNumber(yearAfter)}</T>
          </View>
          {cpkAfter ? (
            <>
              <T variant="meta">Per km · {currency}</T>
              <View style={styles.move}>
                {cpkBefore ? <T style={styles.was}>{cpkBefore.toFixed(2)}</T> : null}
                <T style={styles.now}>{cpkAfter.toFixed(2)}</T>
              </View>
            </>
          ) : null}
        </View>
      ) : null}

      <Rule />
      <View style={styles.wont}>
        <T variant="eyebrowStrong">WHAT WILL NOT HAPPEN</T>
        {['Nothing is paid or charged from Carma.', 'No one outside this garage is told.', 'Existing records are not edited.'].map((t) => (
          <T key={t} variant="meta">
            — {t}
          </T>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  item: {
    flexDirection: 'row',
    gap: 14,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderSoft,
  },
  itemText: {
    flex: 1,
    gap: 5,
  },
  sub: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingTop: 10,
  },
  subKey: {
    width: 84,
  },
  subVal: {
    flex: 1,
    color: Colors.ink,
  },
  totals: {
    paddingVertical: Spacing.lg,
    gap: 6,
  },
  move: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 10,
    marginBottom: 8,
  },
  was: {
    fontSize: 14,
    color: Colors.textMuted,
    textDecorationLine: 'line-through',
  },
  now: {
    fontFamily: FontFamily.medium,
    fontSize: 24,
    color: Colors.ink,
  },
  wont: {
    paddingVertical: Spacing.lg,
    gap: 8,
  },
});
