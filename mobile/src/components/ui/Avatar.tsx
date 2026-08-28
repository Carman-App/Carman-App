import { StyleSheet, View } from 'react-native';

import { T } from '@/components/ui/Typography';
import { Colors, Radius } from '@/theme/tokens';
import { initials } from '@/lib/format';

type AvatarProps = {
  name: string;
  size?: number;
  color?: string;
};

export function Avatar({ name, size = 40, color = Colors.accent }: AvatarProps) {
  return (
    <View style={[styles.base, { width: size, height: size, borderRadius: size / 2, backgroundColor: color + '1A' }]}>
      <T variant="meta" color={color} style={{ fontFamily: undefined, fontSize: size * 0.36 }}>
        {initials(name)}
      </T>
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
