import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import { IconGlyph } from '@/components/ui/IconGlyph';
import { T } from '@/components/ui/Typography';
import { Colors, FontFamily, Radius, Spacing, Tracking } from '@/theme/tokens';

type ChipProps = {
  label: string;
  value?: string;
  /** Badge colours. Without them the chip renders as the design's outlined filter pill. */
  fg?: string;
  bg?: string;
  onPress?: () => void;
  selected?: boolean;
  glyph?: string;
  /**
   * The set-up screens' option chip (powertrain, transmission, "On my own"):
   * outlined; once chosen soft blue with a blue outline and blue text.
   */
  outline?: boolean;
  /** Tracked uppercase label at 10px, as on "MONTH · YEAR · ALL TIME". */
  caps?: boolean;
  /** Compact (28px) badge size. */
  small?: boolean;
  style?: ViewStyle;
};

/** Pill used for filters, choice chips and status badges. */
export function Chip({ label, value, fg, bg, onPress, selected, glyph, outline, caps, small, style }: ChipProps) {
  const Wrapper = onPress ? Pressable : View;
  const isBadge = !!bg && !selected;
  const ink = outline ? (selected ? Colors.accent : Colors.slate) : selected ? Colors.white : (fg ?? Colors.body);
  return (
    <Wrapper
      onPress={onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityState={onPress ? { selected: !!selected } : undefined}
      style={[
        styles.base,
        small && styles.small,
        caps && styles.capsBox,
        isBadge ? { backgroundColor: bg, borderColor: 'transparent' } : null,
        outline ? (selected ? styles.outlineOn : styles.outlineOff) : selected && styles.selected,
        style,
      ]}>
      {glyph ? <IconGlyph glyph={glyph} size={20} bg="transparent" fg={selected && !outline ? Colors.white : Colors.accent} scale={0.85} /> : null}
      <T
        numberOfLines={1}
        color={ink}
        style={[styles.label, small && styles.labelSmall, caps && styles.caps, selected && caps && styles.capsSelected]}>
        {value ? `${label} ${value}` : label}
      </T>
    </Wrapper>
  );
}

type SegmentedProps<K extends string> = {
  options: { key: K; label: string }[];
  value: K;
  onChange: (key: K) => void;
  caps?: boolean;
  style?: ViewStyle;
};

/** Row of choice chips where exactly one is selected (MONTH / YEAR / ALL TIME). */
export function Segmented<K extends string>({ options, value, onChange, caps = true, style }: SegmentedProps<K>) {
  return (
    <View style={[styles.segRow, style]}>
      {options.map((o) => (
        <Chip key={o.key} label={o.label} caps={caps} small selected={o.key === value} onPress={() => onChange(o.key)} />
      ))}
    </View>
  );
}

type ToggleTrackProps<K extends string> = {
  options: { key: K; label: string; glyph?: string }[];
  value: K;
  onChange: (key: K) => void;
};

/** Grey track with a raised white thumb, used for the home Garage | Vehicle switch. */
export function ToggleTrack<K extends string>({ options, value, onChange }: ToggleTrackProps<K>) {
  return (
    <View style={styles.track}>
      {options.map((o) => {
        const on = o.key === value;
        return (
          <Pressable accessibilityRole="button" key={o.key} onPress={() => onChange(o.key)} style={[styles.thumb, on && styles.thumbOn]}>
            {o.glyph ? <IconGlyph glyph={o.glyph} size={18} bg="transparent" fg={on ? Colors.accent : Colors.textMuted} scale={0.9} /> : null}
            <T numberOfLines={1} style={[styles.thumbLabel, { color: on ? Colors.accent : Colors.textMuted }, on && styles.thumbLabelOn]}>
              {o.label}
            </T>
          </Pressable>
        );
      })}
    </View>
  );
}

type StatPillProps = {
  label: string;
  children?: ReactNode;
};

export function StatPill({ label, children }: StatPillProps) {
  return (
    <View style={styles.statPill}>
      <T variant="eyebrow">{label}</T>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  outlineOff: {
    borderColor: 'rgba(19,75,156,0.16)',
    backgroundColor: Colors.white,
  },
  outlineOn: {
    borderColor: 'rgba(19,75,156,0.55)',
    backgroundColor: Colors.accentSoft,
  },
  base: {
    minHeight: 40,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    backgroundColor: Colors.white,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
  },
  small: {
    minHeight: 28,
    paddingHorizontal: 12,
  },
  capsBox: {
    minHeight: 30,
    paddingHorizontal: 14,
  },
  selected: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  label: {
    fontFamily: FontFamily.medium,
    fontSize: 14,
  },
  labelSmall: {
    fontSize: 12,
  },
  caps: {
    fontFamily: FontFamily.medium,
    fontSize: 10,
    letterSpacing: Tracking.label,
    textTransform: 'uppercase',
  },
  capsSelected: {
    fontFamily: FontFamily.bold,
  },
  segRow: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  track: {
    height: 44,
    borderRadius: Radius.pill,
    backgroundColor: Colors.surfaceMuted,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 3,
    gap: 2,
    flexShrink: 1,
  },
  thumb: {
    height: 38,
    borderRadius: Radius.pill,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 13,
    flexShrink: 1,
  },
  thumbOn: {
    backgroundColor: Colors.white,
    shadowColor: '#14161A',
    shadowOpacity: 0.07,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  thumbLabel: {
    fontSize: 13,
  },
  thumbLabelOn: {
    fontFamily: FontFamily.semiBold,
  },
  statPill: {
    gap: 4,
  },
});
