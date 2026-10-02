import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import { IconGlyph } from '@/components/ui/IconGlyph';
import { T } from '@/components/ui/Typography';
import { Colors } from '@/theme/tokens';

type ListRowProps = {
  title: string;
  subtitle?: string;
  /** Render the subtitle in the tracked-uppercase voice ("TOYOTA · 2018 · DAILY DRIVER"). */
  subtitleCaps?: boolean;
  meta?: string;
  metaColor?: string;
  right?: ReactNode;
  left?: ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
  bordered?: boolean;
  chevron?: boolean;
  /** A coloured bar down the left edge, as on job-board groups and "GOES" rows. */
  accentBar?: string;
};

/** Hairline-separated row: tile/avatar, title + subtitle, right value or chevron. */
export function ListRow({
  title,
  subtitle,
  subtitleCaps,
  meta,
  metaColor,
  right,
  left,
  onPress,
  style,
  bordered = true,
  chevron,
  accentBar,
}: ListRowProps) {
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
      {accentBar ? <View style={[styles.bar, { backgroundColor: accentBar }]} /> : null}
      {left ? <View>{left}</View> : null}
      <View style={styles.center}>
        <T variant="bodyStrong" numberOfLines={2}>
          {title}
        </T>
        {subtitle ? (
          <T variant={subtitleCaps ? 'eyebrow' : 'meta'} numberOfLines={3}>
            {subtitle}
          </T>
        ) : null}
      </View>
      {right ? (
        <View style={styles.right}>{right}</View>
      ) : meta ? (
        <T variant="meta" color={metaColor}>
          {meta}
        </T>
      ) : null}
      {chevron ? <IconGlyph glyph="chevron-right" size={20} bg="transparent" fg={Colors.textFaint} scale={0.9} /> : null}
    </Wrapper>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 13,
  },
  bordered: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderSoft,
  },
  bar: {
    width: 2,
    alignSelf: 'stretch',
    borderRadius: 1,
  },
  center: {
    flex: 1,
    gap: 4,
  },
  right: {
    alignItems: 'flex-end',
    gap: 4,
  },
  pressed: {
    opacity: 0.6,
  },
});
