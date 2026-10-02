import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { IconGlyph } from '@/components/ui/IconGlyph';
import { StepCounter } from '@/components/ui/ProgressSteps';
import { T } from '@/components/ui/Typography';
import { Colors, Spacing } from '@/theme/tokens';

type TopBarProps = {
  /** Tracked label beside the back button: "BACK", "HOME", "VEHICLE". */
  backLabel?: string;
  /** Centred title ("Review", "Garage settings"). Switches the bar to its centred layout. */
  title?: string;
  /** Right side: a tracked label ("VEHICLE QR"), a muted meta ("Owner"), or any node. */
  right?: ReactNode;
  onRight?: () => void;
  /** Shorthand for a "STEP 02 / 06" counter on the right. */
  step?: { step: number; total: number; label?: string };
  onBack?: () => void;
  /** 'close' swaps the arrow for an ×. 'none' hides the button. */
  backGlyph?: 'back' | 'close' | 'none';
  /** Fallback route when there is nothing to go back to. */
  fallback?: string;
};

/**
 * The design's screen header: a 45px pale-blue round back button, a tracked
 * label beside it, and a tracked label or step counter on the right. With a
 * `title`, the title sits between them in 14px medium ink.
 */
export function TopBar({ backLabel, title, right, onRight, step, onBack, backGlyph = 'back', fallback = '/home' }: TopBarProps) {
  const router = useRouter();
  const goBack =
    onBack ??
    (() => {
      if (router.canGoBack()) router.back();
      else router.replace(fallback as never);
    });

  const rightNode =
    step ? (
      <StepCounter step={step.step} total={step.total} label={step.label} />
    ) : typeof right === 'string' ? (
      title ? (
        <T variant="meta" numberOfLines={1}>
          {right}
        </T>
      ) : (
        <T variant="eyebrow" color={onRight ? Colors.accent : Colors.body} numberOfLines={1}>
          {right}
        </T>
      )
    ) : (
      right ?? null
    );

  return (
    <View style={[styles.bar, title ? styles.barTitled : null]}>
      {backGlyph === 'none' ? (
        <View style={styles.side} />
      ) : (
        <Pressable onPress={goBack} hitSlop={8} style={styles.back} accessibilityRole="button" accessibilityLabel={backLabel ?? 'Back'}>
          <IconGlyph glyph={backGlyph === 'close' ? 'close' : 'back'} size={45} fg={Colors.body} scale={0.53} />
          {backLabel && !title ? (
            <T variant="eyebrow" color={Colors.body}>
              {backLabel}
            </T>
          ) : null}
        </Pressable>
      )}
      {title ? (
        <T variant="bodyStrong" numberOfLines={1} style={styles.title}>
          {title}
        </T>
      ) : null}
      {onRight ? (
        <Pressable onPress={onRight} hitSlop={8} style={[styles.right, title ? styles.side : null]}>
          {rightNode}
        </Pressable>
      ) : (
        <View style={[styles.right, title ? styles.side : null]}>{rightNode}</View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.sm,
  },
  barTitled: {
    paddingHorizontal: 18,
  },
  back: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  title: {
    flex: 1,
    textAlign: 'center',
    fontSize: 14,
  },
  side: {
    minWidth: 45,
  },
  right: {
    alignItems: 'flex-end',
    flexShrink: 1,
  },
});
