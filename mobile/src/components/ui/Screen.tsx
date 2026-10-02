import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors, Spacing } from '@/theme/tokens';

type ScreenProps = {
  children: ReactNode;
  scroll?: boolean;
  padded?: boolean;
  style?: ViewStyle;
  contentStyle?: ViewStyle;
  /** Fixed chrome above the scrolling body (usually a `TopBar`). */
  header?: ReactNode;
  /** Fixed actions below the body (usually the yellow CTA). */
  footer?: ReactNode;
  /** Hairline between the header and the body, as on centred-title screens. */
  headerRule?: boolean;
  background?: string;
};

/** Base screen container: white ground, safe-area aware, fixed header + footer around an optional scroll body. */
export function Screen({
  children,
  scroll = true,
  padded = true,
  style,
  contentStyle,
  header,
  footer,
  headerRule,
  background = Colors.background,
}: ScreenProps) {
  const Body = scroll ? ScrollView : View;
  const bodyProps = scroll
    ? {
        style: styles.flex,
        contentContainerStyle: [padded && styles.padded, contentStyle],
        showsVerticalScrollIndicator: false,
        keyboardShouldPersistTaps: 'handled' as const,
      }
    : { style: [styles.flex, padded && styles.padded, contentStyle] };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: background }, style]} edges={['top', 'left', 'right', 'bottom']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {header ? <View style={headerRule ? styles.headerRule : null}>{header}</View> : null}
        <Body {...bodyProps}>{children}</Body>
        {footer ? <View style={styles.footer}>{footer}</View> : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  padded: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xxxl,
  },
  headerRule: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  footer: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
    gap: Spacing.sm,
  },
});
