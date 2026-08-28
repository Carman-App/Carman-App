import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { T } from '@/components/ui/Typography';
import { Colors, Spacing } from '@/theme/tokens';

type SectionHeaderProps = {
  title: string;
  action?: string;
  onAction?: () => void;
  right?: ReactNode;
};

export function SectionHeader({ title, action, onAction, right }: SectionHeaderProps) {
  return (
    <View style={styles.row}>
      <T variant="eyebrow">{title}</T>
      {action ? (
        <Pressable onPress={onAction}>
          <T variant="eyebrowStrong" color={Colors.accent}>
            {action}
          </T>
        </Pressable>
      ) : (
        right ?? null
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
});
