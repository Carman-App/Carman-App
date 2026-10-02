import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View, type KeyboardTypeOptions, type ViewStyle } from 'react-native';

import { IconGlyph } from '@/components/ui/IconGlyph';
import { T } from '@/components/ui/Typography';
import { Colors, FontFamily, Radius, Size, Spacing, Tracking } from '@/theme/tokens';

type TextFieldProps = {
  label?: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  keyboardType?: KeyboardTypeOptions;
  multiline?: boolean;
  /** Small tracked unit before the value, e.g. "KES". */
  prefix?: string;
  /** Small unit after the value, e.g. "km". */
  suffix?: string;
  autoFocus?: boolean;
  helper?: string;
  glyph?: string;
  /** Emphasised (pale-blue filled) field, used for the amount that leads every record form. */
  emphasis?: boolean;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  style?: ViewStyle;
};

/** The design's pill input: label above, 1px tinted-blue outline, 52px tall. */
export function TextField({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  multiline,
  prefix,
  suffix,
  autoFocus,
  helper,
  glyph,
  emphasis,
  autoCapitalize,
  style,
}: TextFieldProps) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={[styles.wrap, style]}>
      {label ? (
        <T variant="small" color={Colors.body}>
          {label}
        </T>
      ) : null}
      <View
        style={[
          styles.field,
          multiline && styles.multiline,
          emphasis && styles.emphasis,
          focused && styles.focused,
        ]}>
        {glyph ? <IconGlyph glyph={glyph} size={22} bg="transparent" fg={Colors.teal} scale={0.9} /> : null}
        {prefix ? <T style={styles.unit}>{prefix}</T> : null}
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={Colors.textFaint}
          keyboardType={keyboardType}
          multiline={multiline}
          autoFocus={autoFocus}
          autoCapitalize={autoCapitalize}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={[styles.input, multiline && styles.inputMultiline]}
        />
        {suffix ? <T style={styles.unit}>{suffix}</T> : null}
      </View>
      {helper ? <T variant="meta">{helper}</T> : null}
    </View>
  );
}

type FieldRowProps = {
  label: string;
  value?: string;
  placeholder?: string;
  onPress?: () => void;
  caret?: boolean;
  disabled?: boolean;
  valueColor?: string;
};

/**
 * Pill with a tracked key on the left and the value on the right, e.g.
 * "MAKE ............ Toyota ▾". Used for pickers and read-only summaries.
 */
export function FieldRow({ label, value, placeholder = 'Select', onPress, caret = true, disabled, valueColor }: FieldRowProps) {
  const has = !!value;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || !onPress}
      style={({ pressed }) => [styles.row, pressed && { borderColor: Colors.lineStrong }, disabled && { opacity: 0.5 }]}>
      <T style={styles.rowKey}>{label}</T>
      <View style={styles.rowValue}>
        <T numberOfLines={1} style={[styles.rowValueText, { color: valueColor ?? (has ? Colors.accent : Colors.textMuted) }]}>
          {has ? value : placeholder}
        </T>
        {caret && onPress ? <View style={[styles.caret, { borderTopColor: has ? Colors.accent : Colors.textFaint }]} /> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: Spacing.xs,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    minHeight: Size.field,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.line,
    paddingHorizontal: Spacing.lg,
    backgroundColor: Colors.white,
  },
  emphasis: {
    backgroundColor: Colors.accentSoft,
    borderColor: Colors.lineStrong,
  },
  focused: {
    borderColor: Colors.accent,
  },
  multiline: {
    alignItems: 'flex-start',
    borderRadius: Radius.lg,
    paddingVertical: Spacing.sm,
  },
  input: {
    outlineWidth: 0,
    flex: 1,
    fontFamily: FontFamily.medium,
    fontSize: 15,
    letterSpacing: -0.15,
    color: Colors.body,
    paddingVertical: 12,
  },
  inputMultiline: {
    minHeight: 72,
    paddingVertical: 2,
    textAlignVertical: 'top',
  },
  unit: {
    fontFamily: FontFamily.regular,
    fontSize: 10,
    letterSpacing: Tracking.label,
    color: Colors.slate,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
    height: Size.field,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.line,
    paddingHorizontal: Spacing.lg,
  },
  rowKey: {
    fontSize: 10,
    letterSpacing: Tracking.label + 0.2,
    textTransform: 'uppercase',
    color: Colors.slate,
  },
  rowValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    flexShrink: 1,
  },
  rowValueText: {
    fontFamily: FontFamily.medium,
    fontSize: 14,
  },
  caret: {
    width: 0,
    height: 0,
    borderLeftWidth: 4,
    borderRightWidth: 4,
    borderTopWidth: 5,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
});
