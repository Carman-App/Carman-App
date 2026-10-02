import { StyleSheet, View } from 'react-native';

import { IconGlyph } from '@/components/ui/IconGlyph';
import { T } from '@/components/ui/Typography';
import { Colors, Spacing } from '@/theme/tokens';

/** "Service and repair history · 41 RECORDS · 2026 ONWARD ........ GOES" */
export function TransferRow({ title, sub, goes, glyph, tag = true }: { title: string; sub: string; goes: boolean; glyph: string; tag?: boolean }) {
  return (
    <View style={styles.row}>
      <View style={[styles.bar, { backgroundColor: goes ? Colors.accent : Colors.chipStrong }]} />
      <IconGlyph glyph={glyph} size={28} shape="tile" bg={goes ? Colors.accentSoft : Colors.chip} fg={goes ? Colors.accent : Colors.textMuted} />
      <View style={styles.text}>
        <T variant="bodyStrong" color={goes ? Colors.ink : Colors.accent}>
          {title}
        </T>
        <T variant="eyebrow" color={Colors.slate}>
          {sub}
        </T>
      </View>
      {tag ? (
        <T variant="eyebrowStrong" color={goes ? Colors.accent : Colors.textFaint}>
          {goes ? 'GOES' : 'STAYS'}
        </T>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: Colors.borderSoft,
  },
  bar: {
    width: 2,
    height: 30,
    marginLeft: -Spacing.xs,
  },
  text: {
    flex: 1,
    gap: 6,
  },
});
