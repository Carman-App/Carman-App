import type { ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconGlyph } from '@/components/ui/IconGlyph';
import { T } from '@/components/ui/Typography';
import { Colors, Radius, Spacing, Layout } from '@/theme/tokens';

export type SheetOption = {
  key: string;
  label: string;
  meta?: string;
  glyph?: string;
  tint?: string;
  hue?: string;
};

type OptionSheetProps = {
  visible: boolean;
  title: string;
  lede?: string;
  options: SheetOption[];
  selected?: string | null;
  onSelect: (key: string) => void;
  onClose: () => void;
  /** Two-column tile grid instead of rows (the "Add a record" selector). */
  grid?: boolean;
  footer?: ReactNode;
};

/** Bottom sheet over a Carma-blue scrim: 32px title, close ×, a list or grid of options. */
export function OptionSheet({ visible, title, lede, options, selected, onSelect, onClose, grid, footer }: OptionSheetProps) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, Spacing.md) + Spacing.sm }]} onPress={(e) => e.stopPropagation()}>
          <View style={styles.header}>
            <View style={styles.headerText}>
              <T variant="display">{title}</T>
              {lede ? <T variant="lede">{lede}</T> : null}
            </View>
            <Pressable onPress={onClose} hitSlop={10} style={styles.close} accessibilityLabel="Close">
              <IconGlyph glyph="close" size={36} bg={Colors.chip} fg={Colors.body} />
            </Pressable>
          </View>
          <ScrollView style={styles.list} contentContainerStyle={grid ? styles.grid : null} showsVerticalScrollIndicator={false}>
            {options.map((o) => {
              const on = o.key === selected;
              if (grid) {
                return (
                  <Pressable
                    key={o.key}
                    onPress={() => onSelect(o.key)}
                    style={({ pressed }) => [styles.tile, pressed && { backgroundColor: Colors.accentSoft }]}>
                    {o.glyph ? <IconGlyph glyph={o.glyph} size={34} shape="tile" bg={o.tint ?? Colors.accentSoft} fg={o.hue ?? Colors.accent} /> : null}
                    <T variant="bodyStrong" numberOfLines={2} style={styles.tileLabel}>
                      {o.label}
                    </T>
                  </Pressable>
                );
              }
              return (
                <Pressable
                  key={o.key}
                  onPress={() => onSelect(o.key)}
                  style={({ pressed }) => [styles.row, on && styles.rowOn, pressed && { opacity: 0.7 }]}>
                  {o.glyph ? <IconGlyph glyph={o.glyph} size={36} shape="tile" bg={o.tint ?? Colors.accentSoft} fg={o.hue ?? Colors.accent} /> : null}
                  <View style={styles.rowText}>
                    <T variant="bodyStrong" color={on ? Colors.accent : Colors.ink}>
                      {o.label}
                    </T>
                    {o.meta ? <T variant="eyebrow">{o.meta}</T> : null}
                  </View>
                  <View style={[styles.radio, on && styles.radioOn]}>{on ? <View style={styles.radioDot} /> : null}</View>
                </Pressable>
              );
            })}
          </ScrollView>
          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: Colors.scrim,
  },
  sheet: {
    width: '100%',
    maxWidth: Layout.maxWidth,
    alignSelf: 'center',
    maxHeight: '86%',
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: 14,
  },
  headerText: {
    flex: 1,
    gap: 8,
  },
  close: {
    marginTop: -2,
  },
  list: {
    paddingHorizontal: Spacing.lg,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 8,
    paddingBottom: Spacing.sm,
  },
  tile: {
    width: '48.8%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.borderSoft,
  },
  tileLabel: {
    flex: 1,
    fontSize: 13,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: Colors.borderSoft,
  },
  rowOn: {},
  rowText: {
    flex: 1,
    gap: 5,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: Colors.chipStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOn: {
    borderColor: Colors.accent,
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.accent,
  },
  footer: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
  },
});
