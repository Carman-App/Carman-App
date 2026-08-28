import { Pressable, StyleSheet, View } from 'react-native';

import { Chip } from '@/components/ui/Chip';
import { T } from '@/components/ui/Typography';
import { formatDateLong, todayIso } from '@/lib/format';
import { Colors, Spacing } from '@/theme/tokens';

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

type Props = {
  value: string;
  onChange: (iso: string) => void;
  onOpenPicker?: () => void;
};

/** DATE row: "Today · <long date>" display plus Today/Yesterday quick chips, reused across fuel/expense/service. */
export function DateQuickPick({ value, onChange, onOpenPicker }: Props) {
  const today = todayIso();
  const yesterday = isoDaysAgo(1);
  return (
    <View>
      <T variant="bodyStrong" style={styles.value}>
        {value === today ? `Today · ${formatDateLong(value)}` : formatDateLong(value)}
      </T>
      <View style={styles.row}>
        <Chip label="Today" selected={value === today} onPress={() => onChange(today)} />
        <Chip label="Yesterday" selected={value === yesterday} onPress={() => onChange(yesterday)} />
        {onOpenPicker ? (
          <Pressable onPress={onOpenPicker} style={styles.more}>
            <T variant="eyebrowStrong" color={Colors.accent}>
              MORE →
            </T>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  value: {
    marginBottom: Spacing.xs,
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.xs,
    alignItems: 'center',
  },
  more: {
    paddingHorizontal: Spacing.xs,
    paddingVertical: 6,
  },
});
