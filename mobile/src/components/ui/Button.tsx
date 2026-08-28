import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, type ViewStyle } from 'react-native';

import { T } from '@/components/ui/Typography';
import { Colors, FontFamily, Radius, Spacing } from '@/theme/tokens';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'md' | 'lg';

type ButtonProps = {
  children: ReactNode;
  onPress?: () => void;
  variant?: Variant;
  size?: Size;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  fullWidth?: boolean;
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
}: ButtonProps) {
  const isDisabled = disabled || loading;
  const isTextChildren =
    typeof children === 'string' ||
    (Array.isArray(children) &&
      children.every((c) => typeof c === 'string' || typeof c === 'number' || c === null || c === undefined || typeof c === 'boolean'));
  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        size === 'md' && styles.md,
        fullWidth && styles.fullWidth,
        isDisabled && styles.disabled,
        pressed && !isDisabled && styles.pressed,
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? Colors.white : variant === 'danger' ? Colors.danger : Colors.accent} />
      ) : isTextChildren ? (
        <T
          variant="bodyStrong"
          color={variant === 'primary' ? Colors.white : variant === 'danger' ? Colors.danger : Colors.accent}
          center
          style={{ fontFamily: FontFamily.semiBold }}>
          {children}
        </T>
      ) : (
        children
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: Radius.md,
    paddingVertical: 14,
    paddingHorizontal: Spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  md: {
    paddingVertical: 10,
  },
  fullWidth: {
    alignSelf: 'stretch',
  },
  primary: {
    backgroundColor: Colors.accent,
  },
  secondary: {
    backgroundColor: Colors.accentSoft,
  },
  ghost: {
    backgroundColor: 'transparent',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  danger: {
    backgroundColor: Colors.dangerSoft,
  },
  disabled: {
    opacity: 0.45,
  },
  pressed: {
    opacity: 0.8,
  },
});
