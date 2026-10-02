import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { ModalHeader } from '@/components/ui/ModalHeader';
import { Screen } from '@/components/ui/Screen';
import { T } from '@/components/ui/Typography';
import { formatDateLong, todayIso } from '@/lib/format';
import { Colors, Radius, Spacing } from '@/theme/tokens';

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const QUICK = [
  { label: 'Today', days: 0 },
  { label: 'Yesterday', days: 1 },
  { label: '2 days ago', days: 2 },
  { label: 'Last week', days: 7 },
];

/**
 * Standalone "pick a date" screen — a self-contained demo (no cross-screen
 * return value plumbing). Confirming just closes back to the caller; the
 * caller's own inline DateQuickPick chips are the real value used on save.
 */
export default function PickDateScreen() {
  const [chosen, setChosen] = useState(todayIso());

  const monthDays = useMemo(() => {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstWeekday = new Date(year, month, 1).getDay();
    const cells: (number | null)[] = Array(firstWeekday).fill(null);
    for (let d = 1; d <= daysInMonth; d += 1) cells.push(d);
    return { cells, year, month };
  }, []);

  const isoForDay = (day: number) => `${monthDays.year}-${String(monthDays.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const maxIso = todayIso();

  return (
    <Screen footer={<Button onPress={() => router.back()}>Set date · {formatDateLong(chosen)}</Button>}>
      <ModalHeader eyebrow="ADD RECORD" title="When did this happen?" />

      <View style={styles.chipsRow}>
        {QUICK.map((q) => {
          const iso = isoDaysAgo(q.days);
          return <Chip key={q.label} label={q.label} selected={chosen === iso} onPress={() => setChosen(iso)} />;
        })}
      </View>

      <View style={styles.calendar}>
        {monthDays.cells.map((day, i) => {
          if (day == null) return <View key={`empty-${i}`} style={styles.dayCell} />;
          const iso = isoForDay(day);
          const disabled = iso > maxIso;
          const selected = chosen === iso;
          return (
            <Pressable
              key={iso}
              disabled={disabled}
              onPress={() => setChosen(iso)}
              style={[styles.dayCell, selected && styles.dayCellSelected]}>
              <T variant="bodyStrong" color={disabled ? Colors.disabled : selected ? Colors.white : Colors.text}>
                {day}
              </T>
            </Pressable>
          );
        })}
      </View>

      <T variant="meta" color={Colors.textMuted} style={styles.footnote}>
        A record can be backdated. Future dates are not available.
      </T>
    </Screen>
  );
}

const styles = StyleSheet.create({
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginBottom: Spacing.lg,
  },
  calendar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  dayCell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.sm,
  },
  dayCellSelected: {
    backgroundColor: Colors.accent,
  },
  footnote: {
    marginTop: Spacing.lg,
  },
});
