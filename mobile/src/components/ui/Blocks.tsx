import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Switch as RNSwitch, View, type ViewStyle } from 'react-native';

import { T } from '@/components/ui/Typography';
import { Colors, FontFamily, Radius, Spacing, Tracking } from '@/theme/tokens';

/**
 * Small layout blocks shared by the redesigned screens. Each one is a
 * pattern that recurs across the design bundle.
 */

type ScreenTitleProps = {
  title: string;
  lede?: string;
  eyebrow?: string;
  eyebrowColor?: string;
  style?: ViewStyle;
  children?: ReactNode;
};

/** 32px heavy title with a slate-blue lede under it ("Where are you based?"). */
export function ScreenTitle({ title, lede, eyebrow, eyebrowColor, style, children }: ScreenTitleProps) {
  return (
    <View style={[styles.title, style]}>
      {eyebrow ? (
        <T variant="eyebrow" color={eyebrowColor ?? Colors.accent}>
          {eyebrow}
        </T>
      ) : null}
      <T variant="display">{title}</T>
      {lede ? (
        <T variant="lede" style={styles.lede}>
          {lede}
        </T>
      ) : null}
      {children}
    </View>
  );
}

/** Full-bleed hairline used between sections. Negative margins cancel the screen gutter. */
export function Rule({ tinted, bleed = true, style }: { tinted?: boolean; bleed?: boolean; style?: ViewStyle }) {
  return <View style={[styles.rule, tinted && styles.ruleTinted, bleed && styles.bleed, style]} />;
}

type KeyValueRowProps = {
  label: string;
  value: ReactNode;
  sub?: string;
  /** 'plain': "Vehicle  Prado" in body text. 'caps': "REGISTRATION ...... KDG 441X" with a tracked key. */
  tone?: 'plain' | 'caps';
  onPress?: () => void;
  valueColor?: string;
  last?: boolean;
};

/** Two-column key/value row with a hairline, as on Approval, Odometer and Vehicle details. */
export function KeyValueRow({ label, value, sub, tone = 'plain', onPress, valueColor, last }: KeyValueRowProps) {
  const Wrapper = onPress ? Pressable : View;
  return (
    <Wrapper onPress={onPress} style={[styles.kv, !last && styles.kvRule]}>
      {tone === 'caps' ? (
        <T variant="eyebrow" color={Colors.slate} style={styles.kvKeyCaps}>
          {label}
        </T>
      ) : (
        <T variant="meta" style={styles.kvKey}>
          {label}
        </T>
      )}
      <View style={[styles.kvValue, tone === 'caps' && styles.kvValueRight]}>
        {typeof value === 'string' || typeof value === 'number' ? (
          <T
            variant="body"
            color={valueColor ?? Colors.ink}
            style={[styles.kvValueText, tone === 'caps' && { textAlign: 'right' }]}>
            {value}
          </T>
        ) : (
          value
        )}
        {sub ? (
          <T variant="small" style={tone === 'caps' ? { textAlign: 'right' } : null}>
            {sub}
          </T>
        ) : null}
      </View>
    </Wrapper>
  );
}

export type SpendSegment = { key: string; label: string; value: number; color: string };

/** Stacked spend bar with gaps between segments, plus an optional legend. */
export function SpendBar({ segments, legend = true, height = 6 }: { segments: SpendSegment[]; legend?: boolean; height?: number }) {
  const total = segments.reduce((s, x) => s + Math.max(0, x.value), 0);
  const shown = segments.filter((s) => s.value > 0);
  return (
    <View style={styles.spendWrap}>
      <View style={[styles.spendBar, { height }]}>
        {total === 0 ? (
          <View style={[styles.spendSeg, { flex: 1, backgroundColor: Colors.chip }]} />
        ) : (
          shown.map((s) => <View key={s.key} style={[styles.spendSeg, { flex: s.value, backgroundColor: s.color }]} />)
        )}
      </View>
      {legend && total > 0 ? (
        <View style={styles.legend}>
          {shown.map((s) => (
            <View key={s.key} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: s.color }]} />
              <T variant="eyebrow" color={Colors.slate}>
                {s.label} {Math.round((s.value / total) * 100)}%
              </T>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

/**
 * The design's tick-mark progress bar: a row of thin blue ticks that fade
 * past `progress` (0..1), with a taller marker at the current position.
 * Used for odometer-to-next-service and month-by-month bars.
 */
export function TickBar({ progress, ticks = 48, height = 16, color = Colors.accent, marker = true }: { progress: number; ticks?: number; height?: number; color?: string; marker?: boolean }) {
  const p = Math.max(0, Math.min(1, progress));
  const cut = Math.round(p * ticks);
  return (
    <View style={[styles.ticks, { height }]}>
      {Array.from({ length: ticks }).map((_, i) => {
        const isMarker = marker && i === cut - 1;
        return (
          <View
            key={i}
            style={[
              styles.tick,
              {
                backgroundColor: i < cut ? color : Colors.lineStrong,
                opacity: i < cut ? 1 : 0.6,
                height: isMarker ? height + 6 : i < cut ? height : height * 0.7,
              },
            ]}
          />
        );
      })}
    </View>
  );
}

/** Filled progress bar (documents expiry, job lines done). */
export function ProgressBar({ progress, color = Colors.accent, track = Colors.chip, height = 4 }: { progress: number; color?: string; track?: string; height?: number }) {
  const p = Math.max(0, Math.min(1, progress));
  return (
    <View style={[styles.pbTrack, { backgroundColor: track, height, borderRadius: height }]}>
      <View style={{ width: `${p * 100}%`, backgroundColor: color, height, borderRadius: height }} />
    </View>
  );
}

/** Note with a blue bar down the left edge ("Authorising adds this repair..."). */
export function Notice({ children, tone = 'blue', style }: { children: ReactNode; tone?: 'blue' | 'red' | 'sand'; style?: ViewStyle }) {
  const bar = tone === 'red' ? Colors.signal : tone === 'sand' ? Colors.cta : Colors.accent;
  const bg = tone === 'sand' ? Colors.surfaceWarm : tone === 'red' ? Colors.signalSoft : 'transparent';
  return (
    <View style={[styles.notice, { borderLeftColor: bar, backgroundColor: bg }, style]}>
      {typeof children === 'string' ? <T variant="body">{children}</T> : children}
    </View>
  );
}

/** Tracked footnote in faint caps ("NOTHING ELSE IS REQUIRED..."). */
export function Footnote({ children, color = Colors.slate, style }: { children: ReactNode; color?: string; style?: ViewStyle }) {
  return (
    <T variant="eyebrow" color={color} style={[styles.footnote, style]}>
      {children}
    </T>
  );
}

/** Coloured status dot. */
export function Dot({ color = Colors.signal, size = 7 }: { color?: string; size?: number }) {
  return <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }} />;
}

/** Brand-blue switch, as on notification preferences. */
export function Toggle({ value, onValueChange }: { value: boolean; onValueChange: (v: boolean) => void }) {
  return (
    <RNSwitch
      value={value}
      onValueChange={onValueChange}
      trackColor={{ false: Colors.chipStrong, true: Colors.accent }}
      thumbColor={Colors.white}
      ios_backgroundColor={Colors.chipStrong}
    />
  );
}

/** Big money figure with a small tracked currency before it ("KES 482,450"). */
export function MoneyFigure({ amount, currency = 'KES', size = 'lg', color = Colors.ink }: { amount: string; currency?: string; size?: 'lg' | 'md'; color?: string }) {
  return (
    <View style={styles.money}>
      <T variant="eyebrow" color={Colors.slate} style={styles.moneyUnit}>
        {currency}
      </T>
      <T variant={size === 'lg' ? 'figure' : 'numericLarge'} color={color}>
        {amount}
      </T>
    </View>
  );
}

/** Small boxed stat ("RECORDS 26", "PER MONTH 60,300"). */
export function StatBox({ label, value, accent, style }: { label: string; value: string; accent?: boolean; style?: ViewStyle }) {
  return (
    <View style={[styles.stat, style]}>
      <T variant="eyebrow" color={Colors.slate}>
        {label}
      </T>
      <T style={[styles.statValue, accent && { color: Colors.accent }]}>{value}</T>
    </View>
  );
}

const styles = StyleSheet.create({
  title: {
    paddingTop: 26,
    paddingBottom: 22,
    gap: 6,
  },
  lede: {
    marginTop: 6,
    maxWidth: 320,
  },
  rule: {
    height: 1,
    backgroundColor: Colors.border,
  },
  ruleTinted: {
    backgroundColor: Colors.line,
  },
  bleed: {
    marginHorizontal: -Spacing.lg,
  },
  kv: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    paddingVertical: 14,
  },
  kvRule: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderSoft,
  },
  kvKey: {
    width: 92,
    color: Colors.textMuted,
  },
  kvKeyCaps: {
    flex: 1,
    paddingTop: 3,
  },
  kvValue: {
    flex: 1,
    gap: 4,
  },
  kvValueRight: {
    alignItems: 'flex-end',
  },
  kvValueText: {
    fontFamily: FontFamily.regular,
  },
  spendWrap: {
    gap: 10,
  },
  spendBar: {
    flexDirection: 'row',
    gap: 3,
  },
  spendSeg: {
    height: '100%',
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: 12,
    rowGap: 6,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendDot: {
    width: 7,
    height: 7,
    borderRadius: 2,
  },
  ticks: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  tick: {
    width: 1.5,
    borderRadius: 1,
  },
  pbTrack: {
    overflow: 'hidden',
  },
  notice: {
    borderLeftWidth: 3,
    paddingLeft: 14,
    paddingRight: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  footnote: {
    lineHeight: 16,
    letterSpacing: Tracking.label,
  },
  money: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  moneyUnit: {
    marginBottom: 8,
  },
  stat: {
    flex: 1,
    borderWidth: 1,
    borderColor: Colors.line,
    borderRadius: Radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 6,
  },
  statValue: {
    fontFamily: FontFamily.medium,
    fontSize: 20,
    color: Colors.ink,
  },
});
