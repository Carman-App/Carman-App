import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenTitle } from '@/components/ui/Blocks';
import { TopBar } from '@/components/ui/TopBar';
import { Colors, Spacing } from '@/theme/tokens';

type OnboardingScreenProps = {
  backLabel?: string;
  step?: { step: number; total: number; label?: string };
  right?: ReactNode;
  onRight?: () => void;
  title: string;
  lede?: string;
  eyebrow?: string;
  children?: ReactNode;
  footer?: ReactNode;
  /** Let the body go edge to edge (choice rows draw their own gutters). */
  bleed?: boolean;
  hideBack?: boolean;
  /** Rendered just above the title (an OPTIONAL badge). */
  above?: ReactNode;
};

/** Set-up screen shell: round back button + tracked label, STEP 0n / 06, a 32px title, the body, and the CTA pinned below. */
export function OnboardingScreen({ backLabel = 'BACK', step, right, onRight, title, lede, eyebrow, children, footer, bleed, hideBack, above }: OnboardingScreenProps) {
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
      <TopBar backLabel={backLabel} step={step} right={right} onRight={onRight} backGlyph={hideBack ? 'none' : 'back'} fallback="/onboarding/welcome" />
      <ScrollView style={styles.flex} contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.pad}>
          {above ? <View style={styles.above}>{above}</View> : null}
          <ScreenTitle title={title} lede={lede} eyebrow={eyebrow} style={above ? styles.titleTight : undefined} />
        </View>
        <View style={bleed ? null : styles.pad}>{children}</View>
      </ScrollView>
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  flex: {
    flex: 1,
  },
  body: {
    paddingBottom: Spacing.xl,
  },
  pad: {
    paddingHorizontal: Spacing.lg,
  },
  above: {
    paddingTop: Spacing.lg,
  },
  titleTight: {
    paddingTop: 10,
  },
  footer: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
    gap: Spacing.sm,
  },
});
