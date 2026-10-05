import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { IconGlyph } from '@/components/ui/IconGlyph';
import { T } from '@/components/ui/Typography';
import { Colors, FontFamily, Radius, Shadow, Spacing } from '@/theme/tokens';

type ComposerProps = {
  value: string;
  onChangeText: (v: string) => void;
  onSubmit: () => void;
  placeholder?: string;
  /** Yellow + button: opens the record selector. Hidden when omitted. */
  onAdd?: () => void;
  /** The scope chip ("● Prado"). */
  scopeLabel?: string;
  onScope?: () => void;
  onMic?: () => void;
  /** Second yellow button on the right (mechanic composer's quick action). */
  busy?: boolean;
};

/**
 * Home's one question box: "Type, or hold to speak". The + opens the
 * 18-action record selector, the chip scopes the thread to a vehicle, the
 * mic dictates and the arrow sends.
 */
export function Composer({ value, onChangeText, onSubmit, placeholder = 'Type, or hold to speak', onAdd, scopeLabel, onScope, onMic, busy }: ComposerProps) {
  const canSend = value.trim().length > 0 && !busy;
  return (
    <View style={styles.box}>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={Colors.textSubtle}
        style={styles.input}
        multiline
        returnKeyType="send"
        blurOnSubmit
        onSubmitEditing={() => canSend && onSubmit()}
      />
      <View style={styles.row}>
        {onAdd ? (
          <Pressable accessibilityRole="button" onPress={onAdd} style={({ pressed }) => [styles.add, pressed && { backgroundColor: Colors.ctaPressed }]} accessibilityLabel="Add a record">
            <IconGlyph glyph="add" size={40} bg="transparent" fg={Colors.ink} />
          </Pressable>
        ) : null}
        {scopeLabel ? (
          <Pressable accessibilityRole="button" onPress={onScope} style={styles.scope} accessibilityLabel="Change scope">
            <View style={styles.scopeDot} />
            <T style={styles.scopeLabel} numberOfLines={1}>
              {scopeLabel}
            </T>
          </Pressable>
        ) : null}
        <View style={styles.flex} />
        {onMic ? (
          <Pressable accessibilityRole="button" onPress={onMic} hitSlop={8} accessibilityLabel="Dictate">
            <IconGlyph glyph="mic" size={36} bg="transparent" fg={Colors.textMuted} scale={0.6} />
          </Pressable>
        ) : null}
        <Pressable accessibilityRole="button"
          onPress={onSubmit}
          disabled={!canSend}
          style={[styles.send, { backgroundColor: canSend ? Colors.accent : Colors.chip }]}
          accessibilityLabel="Send">
          <IconGlyph glyph="send" size={40} bg="transparent" fg={canSend ? Colors.white : Colors.textSubtle} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    marginHorizontal: 14,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.borderSoft,
    backgroundColor: Colors.white,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.sm,
    gap: Spacing.sm,
    ...Shadow.raised,
  },
  input: {
    outlineWidth: 0,
    fontFamily: FontFamily.regular,
    fontSize: 15,
    color: Colors.ink,
    minHeight: 24,
    maxHeight: 120,
    paddingVertical: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  flex: {
    flex: 1,
  },
  add: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.cta,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scope: {
    height: 34,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 13,
    borderRadius: Radius.pill,
    backgroundColor: Colors.chip,
    maxWidth: 180,
  },
  scopeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.accent,
  },
  scopeLabel: {
    fontFamily: FontFamily.semiBold,
    fontSize: 12,
    color: Colors.ink,
  },
  send: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
