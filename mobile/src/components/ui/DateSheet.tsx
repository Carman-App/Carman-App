import { useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { IconGlyph } from '@/components/ui/IconGlyph';
import { T } from '@/components/ui/Typography';
import { formatDateLong, todayIso } from '@/lib/format';
import { Colors, FontFamily, Radius, Spacing } from '@/theme/tokens';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function iso(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

type DateSheetProps = {
  visible: boolean;
  value: string;
  onSelect: (iso: string) => void;
  onClose: () => void;
  title?: string;
  /** Allow dates after today (document expiry). Records default to the past only. */
  allowFuture?: boolean;
};

/** Month calendar in a bottom sheet. "Date the reading when you saw it, not when you typed it." */
export function DateSheet({ visible, value, onSelect, onClose, title = 'Pick a date', allowFuture }: DateSheetProps) {
  const start = new Date((value || todayIso()) + 'T00:00:00');
  const [cursor, setCursor] = useState({ y: start.getFullYear(), m: start.getMonth() });
  const [chosen, setChosen] = useState(value || todayIso());
  const today = todayIso();

  const cells = useMemo(() => {
    const first = new Date(cursor.y, cursor.m, 1).getDay();
    const days = new Date(cursor.y, cursor.m + 1, 0).getDate();
    const out: (number | null)[] = Array(first).fill(null);
    for (let d = 1; d <= days; d += 1) out.push(d);
    while (out.length % 7) out.push(null);
    return out;
  }, [cursor]);

  const shift = (delta: number) => {
    const d = new Date(cursor.y, cursor.m + delta, 1);
    setCursor({ y: d.getFullYear(), m: d.getMonth() });
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.head}>
            <T variant="display" style={styles.flex}>
              {title}
            </T>
            <Pressable onPress={onClose} hitSlop={10}>
              <IconGlyph glyph="close" size={36} bg={Colors.chip} fg={Colors.body} />
            </Pressable>
          </View>
          <View style={styles.monthRow}>
            <Pressable onPress={() => shift(-1)} hitSlop={10}>
              <IconGlyph glyph="back" size={36} />
            </Pressable>
            <T style={styles.month}>
              {MONTHS[cursor.m]} {cursor.y}
            </T>
            <Pressable onPress={() => shift(1)} hitSlop={10}>
              <IconGlyph glyph="chevron-right" size={36} />
            </Pressable>
          </View>
          <View style={styles.grid}>
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
              <T key={i} variant="eyebrow" center style={styles.cell}>
                {d}
              </T>
            ))}
            {cells.map((d, i) => {
              if (!d) return <View key={i} style={styles.cell} />;
              const key = iso(cursor.y, cursor.m, d);
              const disabled = !allowFuture && key > today;
              const on = key === chosen;
              return (
                <Pressable key={i} disabled={disabled} onPress={() => setChosen(key)} style={styles.cell}>
                  <View style={[styles.day, on && styles.dayOn, key === today && !on && styles.dayToday]}>
                    <T style={[styles.dayText, on && { color: Colors.white }, disabled && { color: Colors.textFaint }]}>{d}</T>
                  </View>
                </Pressable>
              );
            })}
          </View>
          <View style={styles.foot}>
            <Button
              onPress={() => {
                onSelect(chosen);
                onClose();
              }}>
              {formatDateLong(chosen)}
            </Button>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: Colors.scrim,
  },
  sheet: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    paddingBottom: Spacing.xl,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  flex: {
    flex: 1,
  },
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  month: {
    fontFamily: FontFamily.semiBold,
    fontSize: 15,
    color: Colors.ink,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: Spacing.md,
  },
  cell: {
    width: `${100 / 7}%`,
    alignItems: 'center',
    paddingVertical: 4,
  },
  day: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayOn: {
    backgroundColor: Colors.accent,
  },
  dayToday: {
    borderWidth: 1,
    borderColor: Colors.lineStrong,
  },
  dayText: {
    fontFamily: FontFamily.medium,
    fontSize: 14,
    color: Colors.ink,
  },
  foot: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
});
