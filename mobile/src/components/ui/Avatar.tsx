import { StyleSheet, View } from 'react-native';

import { IconGlyph } from '@/components/ui/IconGlyph';
import { T } from '@/components/ui/Typography';
import { Colors, FontFamily, Radius } from '@/theme/tokens';
import { initials } from '@/lib/format';

type AvatarProps = {
  name: string;
  size?: number;
  color?: string;
  bg?: string;
};

/** Initials disc: warm grey fill with Carma-blue initials, as on member rows. No name yet: a person icon. */
export function Avatar({ name, size = 40, color = Colors.accent, bg = Colors.chip }: AvatarProps) {
  return (
    <View style={[styles.base, { width: size, height: size, borderRadius: size / 2, backgroundColor: bg }]}>
      {name.trim() ? (
        <T color={color} style={{ fontFamily: FontFamily.medium, fontSize: Math.round(size * 0.32) }}>
          {initials(name)}
        </T>
      ) : (
        <IconGlyph glyph="person" size={size} bg="transparent" fg={color} scale={0.5} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.pill,
  },
});
