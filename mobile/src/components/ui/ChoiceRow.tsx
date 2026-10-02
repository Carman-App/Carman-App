import { Pressable, StyleSheet, View } from 'react-native';

import { IconGlyph } from '@/components/ui/IconGlyph';
import { T } from '@/components/ui/Typography';
import { Colors, Spacing } from '@/theme/tokens';

type ChoiceRowProps = {
  title: string;
  sub?: string;
  glyph?: string;
  selected?: boolean;
  onPress: () => void;
  hue?: string;
  tint?: string;
  /** Checkbox (multi-select) instead of a radio. */
  multi?: boolean;
  /** Tracked uppercase subtitle. */
  subCaps?: boolean;
};

/**
 * Full-bleed choice row: soft tile, title + muted sub, radio on the right.
 * The onboarding pickers ("Personal: I own vehicles", "Car", "Daily driver").
 */
export function ChoiceRow({ title, sub, glyph, selected, onPress, hue, tint, multi, subCaps }: ChoiceRowProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={multi ? 'checkbox' : 'radio'}
      accessibilityState={{ checked: !!selected }}
      style={({ pressed }) => [styles.row, selected && styles.rowOn, pressed && { opacity: 0.85 }]}>
      <IconGlyph glyph={glyph ?? 'vehicle'} size={36} shape="tile" bg={selected ? Colors.white : (tint ?? Colors.accentSoft)} fg={hue ?? Colors.accent} />
      <View style={styles.text}>
        <T variant="bodyStrong">{title}</T>
        {sub ? (
          <T variant={subCaps ? 'eyebrow' : 'meta'} color={subCaps ? Colors.slate : Colors.textFaint}>
            {sub}
          </T>
        ) : null}
      </View>
      <View style={[styles.mark, multi && styles.markSquare, selected && styles.markOn, selected && multi && { backgroundColor: Colors.accent }]}>
        {selected ? multi ? <IconGlyph glyph="check" size={16} bg="transparent" fg={Colors.white} scale={0.9} /> : <View style={styles.dot} /> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 18,
    borderTopWidth: 1,
    borderTopColor: Colors.line,
  },
  rowOn: {
    backgroundColor: Colors.accentSoft,
  },
  text: {
    flex: 1,
    gap: 6,
  },
  mark: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: Colors.chipStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markSquare: {
    borderRadius: 6,
  },
  markOn: {
    borderColor: Colors.accent,
    backgroundColor: Colors.white,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.accent,
  },
});
