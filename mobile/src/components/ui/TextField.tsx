import { StyleSheet, TextInput, View, type KeyboardTypeOptions } from 'react-native';

import { T } from '@/components/ui/Typography';
import { Colors, FontFamily, Spacing } from '@/theme/tokens';

type TextFieldProps = {
  label?: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  keyboardType?: KeyboardTypeOptions;
  multiline?: boolean;
  prefix?: string;
  autoFocus?: boolean;
  helper?: string;
};

export function TextField({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  multiline,
  prefix,
  autoFocus,
  helper,
}: TextFieldProps) {
  return (
    <View style={styles.wrap}>
      {label ? <T variant="eyebrow">{label}</T> : null}
      <View style={[styles.field, multiline && styles.multiline]}>
        {prefix ? (
          <T variant="numeric" color={Colors.textMuted}>
            {prefix}
          </T>
        ) : null}
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={Colors.placeholder}
          keyboardType={keyboardType}
          multiline={multiline}
          autoFocus={autoFocus}
          style={[styles.input, multiline && styles.inputMultiline]}
        />
      </View>
      {helper ? (
        <T variant="meta" style={styles.helper}>
          {helper}
        </T>
      ) : null}
    </View>
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
    borderBottomWidth: 1.5,
    borderBottomColor: Colors.border,
    paddingBottom: Spacing.xs,
  },
  multiline: {
    alignItems: 'flex-start',
    paddingBottom: Spacing.sm,
  },
  input: {
    flex: 1,
    fontFamily: FontFamily.medium,
    fontSize: 17,
    color: Colors.text,
    paddingVertical: 4,
  },
  inputMultiline: {
    minHeight: 72,
    textAlignVertical: 'top',
  },
  helper: {
    marginTop: 2,
  },
});
