import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import { T } from '@/components/ui/Typography';
import { Colors, Spacing } from '@/theme/tokens';

type ListRowProps = {
  title: string;
  subtitle?: string;
  meta?: string;
  right?: ReactNode;
  left?: ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
  bordered?: boolean;
};

/** Generic row: left icon/avatar, title + subtitle, right value/chevron. Used across list-style screens. */
export function ListRow({ title, subtitle, meta, right, left, onPress, style, bordered = true }: ListRowProps) {
  const Wrapper = onPress ? Pressable : View;
  return (
    <Wrapper
      onPress={onPress}
      style={({ pressed }: { pressed?: boolean }) => [
        styles.row,
        bordered && styles.bordered,
        pressed && onPress ? styles.pressed : null,
        style,
      ]}>
      {left ? <View style={styles.left}>{left}</View> : null}
      <View style={styles.center}>
        <T variant="bodyStrong">{title}</T>
        {subtitle ? (
          <T variant="meta" style={styles.subtitle}>
            {subtitle}
          </T>
        ) : null}
      </View>
      {right ? <View style={styles.right}>{right}</View> : meta ? <T variant="meta">{meta}</T> : null}
    </Wrapper>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  bordered: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderLight,
  },
  left: {
    marginRight: 2,
  },
  center: {
    flex: 1,
    gap: 2,
  },
  subtitle: {
    marginTop: 1,
  },
  right: {
    alignItems: 'flex-end',
  },
  pressed: {
    opacity: 0.6,
  },
});
