import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import { IconGlyph } from '@/components/ui/IconGlyph';
import { T } from '@/components/ui/Typography';
import { Colors, FontFamily, Radius, Size, Spacing } from '@/theme/tokens';

/**
 * - primary: the yellow pill every flow ends on ("Continue", "Save expense").
 * - strong:  the blue pill for consequential hand-offs ("Hand over to the buyer").
 * - secondary: white pill with an ink hairline ("Invite someone", "Add a line").
 * - soft:    pale-blue pill with blue text ("Add another item").
 * - ghost:   text-only action ("Discard", "Create without members").
 * - danger:  red text action ("Decline").
 */
type Variant = 'primary' | 'strong' | 'secondary' | 'soft' | 'ghost' | 'danger';
type Size = 'md' | 'lg' | 'sm';

type ButtonProps = {
  children: ReactNode;
  onPress?: () => void;
  variant?: Variant;
  size?: Size;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  fullWidth?: boolean;
  glyph?: string;
  /** Tracked uppercase label, as on "START THE HANDOVER". */
  caps?: boolean;
};

const INK: Record<Variant, string> = {
  primary: Colors.ink,
  strong: Colors.white,
  secondary: Colors.ink,
  soft: Colors.accent,
  ghost: Colors.accent,
  danger: Colors.danger,
};

export function Button({
  children,
  onPress,
  variant = 'primary',
  size = 'lg',
  disabled,
  loading,
  style,
  fullWidth = true,
  glyph,
  caps,
}: ButtonProps) {
  const isDisabled = disabled || loading;
  const ink = isDisabled && (variant === 'primary' || variant === 'strong') ? Colors.textFaint : INK[variant];
  const isTextChildren =
    typeof children === 'string' ||
    (Array.isArray(children) &&
      children.every((c) => typeof c === 'string' || typeof c === 'number' || c === null || c === undefined || typeof c === 'boolean'));
  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!isDisabled }}
      style={({ pressed }) => [
        styles.base,
        styles[size],
        styles[variant],
        fullWidth && styles.fullWidth,
        isDisabled && (variant === 'primary' || variant === 'strong') && styles.disabledFill,
        isDisabled && !(variant === 'primary' || variant === 'strong') && styles.disabledFade,
        pressed && !isDisabled && pressedStyle[variant],
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={ink} />
      ) : (
        <>
          {glyph ? <IconGlyph glyph={glyph} size={28} bg="transparent" fg={ink} /> : null}
          {isTextChildren ? (
            <T
              numberOfLines={1}
              color={ink}
              center
              style={[styles.label, size === 'sm' && styles.labelSm, caps && styles.caps]}>
              {children}
            </T>
          ) : (
            children
          )}
        </>
      )}
    </Pressable>
  );
}

type IconButtonProps = {
  glyph: string;
  onPress?: () => void;
  size?: number;
  bg?: string;
  fg?: string;
  accessibilityLabel?: string;
  dot?: boolean;
  style?: ViewStyle;
};

/** The design's round icon button: 45px pale-blue circle (back, settings, insights). */
export function IconButton({
  glyph,
  onPress,
  size = Size.iconButton,
  bg = Colors.accentSoft,
  fg = Colors.body,
  accessibilityLabel,
  dot,
  style,
}: IconButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? glyph}
      style={({ pressed }) => [
        styles.icon,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: pressed && bg === Colors.accentSoft ? Colors.accentSoftPressed : bg },
        pressed && bg !== Colors.accentSoft && { opacity: 0.85 },
        style,
      ]}>
      <IconGlyph glyph={glyph} size={size} bg="transparent" fg={fg} scale={0.53} />
      {dot ? <View style={styles.dot} /> : null}
    </Pressable>
  );
}

const pressedStyle = StyleSheet.create({
  primary: { backgroundColor: Colors.ctaPressed },
  strong: { backgroundColor: Colors.accentPressed },
  secondary: { backgroundColor: '#F7F5F2' },
  soft: { backgroundColor: Colors.accentSoftPressed },
  ghost: { opacity: 0.6 },
  danger: { opacity: 0.6 },
});

const styles = StyleSheet.create({
  base: {
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  lg: {
    height: Size.cta,
  },
  md: {
    height: Size.control,
  },
  sm: {
    height: 40,
    paddingHorizontal: Spacing.md,
  },
  fullWidth: {
    alignSelf: 'stretch',
  },
  primary: {
    backgroundColor: Colors.cta,
  },
  strong: {
    backgroundColor: Colors.accent,
  },
  secondary: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
  },
  soft: {
    backgroundColor: Colors.accentSoft,
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  danger: {
    backgroundColor: 'transparent',
  },
  disabledFill: {
    backgroundColor: Colors.disabled,
  },
  disabledFade: {
    opacity: 0.4,
  },
  label: {
    fontFamily: FontFamily.semiBold,
    fontSize: 14,
    lineHeight: 18,
    letterSpacing: -0.1,
  },
  labelSm: {
    fontSize: 13,
  },
  caps: {
    fontFamily: FontFamily.bold,
    fontSize: 11,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
  },
  icon: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: Colors.signal,
    borderWidth: 2,
    borderColor: Colors.white,
  },
});
