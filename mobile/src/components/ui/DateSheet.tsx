import { useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconGlyph } from '@/components/ui/IconGlyph';
import { T } from '@/components/ui/Typography';
import { todayIso } from '@/lib/format';
import { Colors, FontFamily, Layout } from '@/theme/tokens';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

function iso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

type DateSheetProps = {
  visible: boolean;
  value: string;
  onSelect: (iso: string) => void;
  onClose: () => void;
  /** Kept for callers that name the date; the design's sheet shows the month instead. */
  title?: string;
  /** Allow dates after today (expiry, due and next-charge dates). Records default to the past only. */
  allowFuture?: boolean;
  /** Shows the clear (×) button. Leave out where a date is required. */
  onClear?: () => void;
};

/**
 * Design "date" sheet: month header with arrows, a Monday-first month grid
 * (today ringed in blue, the chosen day solid blue), then Today, Yesterday
 * and clear. Tapping a day picks it and closes the sheet.
 */
export function DateSheet({ visible, value, onSelect, onClose, allowFuture, onClear }: DateSheetProps) {
  const insets = useSafeAreaInsets();
  const today = todayIso();
  const startOf = (v: string) => {
    const d = new Date((v || today) + 'T00:00:00');
    return { y: d.getFullYear(), m: d.getMonth() };
  };
  const [cursor, setCursor] = useState(() => startOf(value));
  // Open on the month of the current value each time (adjusted during render, not in an effect).
  const [openedFor, setOpenedFor] = useState(visible ? value : null);
  if (visible && openedFor !== value) {
    setOpenedFor(value);
    setCursor(startOf(value));
  } else if (!visible && openedFor !== null) {
    setOpenedFor(null);
  }

  const cells = useMemo(() => {
    const lead = (new Date(cursor.y, cursor.m, 1).getDay() + 6) % 7;
    const days = new Date(cursor.y, cursor.m + 1, 0).getDate();
    const out: (string | null)[] = Array(lead).fill(null);
    for (let d = 1; d <= days; d += 1) out.push(iso(new Date(cursor.y, cursor.m, d)));
    while (out.length % 7) out.push(null);
    return out;
  }, [cursor]);

  const shift = (delta: number) => {
    const d = new Date(cursor.y, cursor.m + delta, 1);
    setCursor({ y: d.getFullYear(), m: d.getMonth() });
  };
  const pick = (key: string) => {
    onSelect(key);
    onClose();
  };
  const yesterday = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return iso(d);
  })();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable accessibilityLabel="Close" style={styles.backdrop} onPress={onClose}>
        <Pressable accessible={false} style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 18) }]} onPress={(e) => e.stopPropagation()}>
          <View style={styles.monthRow}>
            <Pressable accessibilityRole="button" onPress={() => shift(-1)} hitSlop={8} style={styles.round} accessibilityLabel="Previous month">
              <IconGlyph glyph="back" size={40} bg="transparent" fg={Colors.ink} scale={0.43} />
            </Pressable>
            <T style={styles.month}>
              {MONTHS[cursor.m]} {cursor.y}
            </T>
            <Pressable accessibilityRole="button" onPress={() => shift(1)} hitSlop={8} style={styles.round} accessibilityLabel="Next month">
              <IconGlyph glyph="arrow-right" size={40} bg="transparent" fg={Colors.ink} scale={0.43} />
            </Pressable>
          </View>
          <View style={[styles.grid, styles.weekdays]}>
            {WEEKDAYS.map((d, i) => (
              <View key={i} style={styles.weekday}>
                <T style={styles.weekdayText}>{d}</T>
              </View>
            ))}
          </View>
          <View style={styles.grid}>
            {cells.map((key, i) => {
              if (!key) return <View key={i} style={styles.cell} />;
              const disabled = !allowFuture && key > today;
              const on = key === value;
              const isToday = key === today;
              return (
                <View key={i} style={styles.cell}>
                  <Pressable accessibilityRole="button"
                    disabled={disabled}
                    onPress={() => pick(key)}
                    style={[styles.day, isToday && !on && styles.dayToday, on && styles.dayOn]}>
                    <T style={[styles.dayText, on && { color: Colors.white }, disabled && { color: '#B4AFA8' }]}>{Number(key.slice(8))}</T>
                  </Pressable>
                </View>
              );
            })}
          </View>
          <View style={styles.foot}>
            <Pressable accessibilityRole="button" onPress={() => pick(today)} style={[styles.pill, styles.pillYellow]}>
              <T style={styles.pillText}>Today</T>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => pick(yesterday)} style={[styles.pill, styles.pillLine]}>
              <T style={styles.pillText}>Yesterday</T>
            </Pressable>
            {onClear ? (
              <Pressable accessibilityRole="button"
                onPress={() => {
                  onClear();
                  onClose();
                }}
                style={styles.clear}
                accessibilityLabel="Clear the date">
                <IconGlyph glyph="close" size={48} bg="transparent" fg="#5F5A55" scale={0.33} />
              </Pressable>
            ) : null}
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
    backgroundColor: 'rgba(20,22,26,0.24)',
  },
  sheet: {
    width: '100%',
    maxWidth: Layout.maxWidth,
    alignSelf: 'center',
    backgroundColor: Colors.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 20,
    paddingHorizontal: 16,
  },
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  round: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F2F0EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  month: {
    fontFamily: FontFamily.medium,
    fontSize: 14,
    color: Colors.ink,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  weekdays: {
    marginTop: 16,
  },
  weekday: {
    width: `${100 / 7}%`,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekdayText: {
    fontFamily: FontFamily.regular,
    fontSize: 10,
    letterSpacing: 1,
    color: Colors.textFaint,
  },
  cell: {
    width: `${100 / 7}%`,
    padding: 1,
  },
  day: {
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayToday: {
    backgroundColor: Colors.accentSoft,
    borderColor: Colors.accent,
  },
  dayOn: {
    backgroundColor: Colors.accent,
  },
  dayText: {
    fontFamily: FontFamily.regular,
    fontSize: 14,
    color: Colors.ink,
  },
  foot: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
  },
  pill: {
    flex: 1,
    height: 48,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillYellow: {
    backgroundColor: '#F8C01D',
  },
  pillLine: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: 'rgba(20,22,26,0.14)',
  },
  pillText: {
    fontFamily: FontFamily.semiBold,
    fontSize: 14,
    color: '#333333',
  },
  clear: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F2F0EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
