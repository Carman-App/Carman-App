import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { IconGlyph } from '@/components/ui/IconGlyph';
import { T } from '@/components/ui/Typography';
import { Spacing } from '@/theme/tokens';

type EmptyStateProps = {
  glyph: string;
  title: string;
  body: string;
  children?: ReactNode;
};

/** First-run / zero-record states (empty garage, empty timeline, empty documents...). */
export function EmptyState({ glyph, title, body, children }: EmptyStateProps) {
  return (
    <View style={styles.wrap}>
      <IconGlyph glyph={glyph} size={56} />
      <T variant="subheading" center style={styles.title}>
        {title}
      </T>
      <T variant="body" color="#6F6C63" center style={styles.body}>
        {body}
      </T>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.md,
  },
  title: {
    marginTop: Spacing.xs,
  },
  body: {
    maxWidth: 300,
  },
});
