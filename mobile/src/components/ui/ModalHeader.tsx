import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { T } from '@/components/ui/Typography';
import { Colors, Spacing } from '@/theme/tokens';

type ModalHeaderProps = {
  title?: string;
  eyebrow?: string;
  onClose?: () => void;
  closeLabel?: string;
};

/** Header row for modal-presented flows (Add Record and its sub-steps): back/close + title. */
export function ModalHeader({ title, eyebrow, onClose, closeLabel = 'CLOSE' }: ModalHeaderProps) {
  const router = useRouter();
  const handleClose = onClose ?? (() => (router.canGoBack() ? router.back() : router.replace('/(app)/(tabs)/garage')));
  return (
    <View style={styles.row}>
      <View style={styles.text}>
        {eyebrow ? <T variant="eyebrow">{eyebrow}</T> : null}
        {title ? <T variant="subheading">{title}</T> : null}
      </View>
      <Pressable onPress={handleClose} hitSlop={10}>
        <T variant="eyebrowStrong" color={Colors.textMuted}>
          {closeLabel}
        </T>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  text: {
    gap: 2,
    flex: 1,
  },
});
