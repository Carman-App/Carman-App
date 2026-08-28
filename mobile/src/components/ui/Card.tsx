import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import { Colors, Radius, Shadow, Spacing } from '@/theme/tokens';

type CardProps = {
  children: ReactNode;
  style?: ViewStyle;
  onPress?: () => void;
  padded?: boolean;
  bordered?: boolean;
};

/** Base surface card: white on warm background, soft shadow, rounded corners. */
export function Card({ children, style, onPress, padded = true, bordered = false }: CardProps) {
  const content = (
    <View style={[styles.base, padded && styles.padded, bordered && styles.bordered, style]}>
      {children}
    </View>
  );
  if (!onPress) return content;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [pressed && styles.pressed]}>
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    ...Shadow.card,
  },
  padded: {
    padding: Spacing.lg,
  },
  bordered: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  pressed: {
    opacity: 0.85,
  },
});
