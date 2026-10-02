import { TopBar } from '@/components/ui/TopBar';

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
  return <TopBar backGlyph="close" onBack={onClose} title={title} backLabel={eyebrow} right={title ? eyebrow : undefined} />;
}
