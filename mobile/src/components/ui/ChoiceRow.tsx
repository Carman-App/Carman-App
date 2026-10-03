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
  /** A second, smaller icon in the tile (design: "Both" shows the car and the wrench). */
  glyph2?: string;
};

/**
 * Full-bleed choice row, as in the design's set-up pickers ("Personal: I own
 * vehicles", "Car", "Daily driver"): a 44px tile (soft blue, or solid blue
 * with a white icon once chosen), title + note, radio on the right.
 */
export function ChoiceRow({ title, sub, glyph, glyph2, selected, onPress, hue, tint, multi, subCaps }: ChoiceRowProps) {
  const tileBg = selected ? (hue ?? Colors.accent) : (tint ?? Colors.accentSoft);
  const iconFg = selected ? Colors.white : (hue ?? Colors.accent);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={multi ? 'checkbox' : 'radio'}
      accessibilityState={{ checked: !!selected }}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.85 }]}>
      {glyph2 ? (
        <View style={[styles.tile, { backgroundColor: tileBg }]}>
          <View style={styles.dualTop}>
            <IconGlyph glyph={glyph ?? 'vehicle'} size={26} bg="transparent" fg={iconFg} scale={0.66} />
          </View>
          <View style={styles.dualBottom}>
            <IconGlyph glyph={glyph2} size={22} bg="transparent" fg={iconFg} scale={0.68} />
          </View>
        </View>
      ) : (
        <IconGlyph glyph={glyph ?? 'vehicle'} size={44} shape="tile" bg={tileBg} fg={iconFg} />
      )}
      <View style={styles.text}>
        <T variant="bodyStrong">{title}</T>
        {sub ? (
          <T variant={subCaps ? 'eyebrow' : 'meta'} color={subCaps ? Colors.slate : selected ? Colors.slate : Colors.textFaint}>
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
  tile: {
    width: 44,
    height: 44,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dualTop: {
    transform: [{ translateY: -4 }],
    marginRight: -5,
  },
  dualBottom: {
    transform: [{ translateY: 5 }],
  },
  text: {
    flex: 1,
    gap: 6,
  },
  mark: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: 'rgba(19,75,156,0.24)',
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
    width: 11,
    height: 11,
    borderRadius: 5.5,
    backgroundColor: Colors.accent,
  },
});
