import { View } from 'react-native';

import { TopBar } from '@/components/ui/TopBar';
import { Spacing } from '@/theme/tokens';

type ModalHeaderProps = {
  title?: string;
  eyebrow?: string;
  onClose?: () => void;
  closeLabel?: string;
};

/**
 * Header for modal-presented flows. Kept as a thin wrapper over `TopBar` so
 * older call sites keep working: a close (×) button, the eyebrow as the
 * tracked label, the title centred.
 */
export function ModalHeader({ title, eyebrow, onClose }: ModalHeaderProps) {
  // Sits inside padded screen content, so cancel the gutter TopBar adds itself.
  return (
    <View style={{ marginHorizontal: -Spacing.lg, marginBottom: Spacing.sm }}>
      <TopBar backGlyph="close" onBack={onClose} title={title} backLabel={eyebrow} right={title ? eyebrow : undefined} />
    </View>
  );
}
