import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconGlyph } from '@/components/ui/IconGlyph';
import { T } from '@/components/ui/Typography';
import { Colors, FontFamily } from '@/theme/tokens';

type SelectSheetProps = {
  visible: boolean;
  title: string;
  glyph?: string;
  options: { label: string; glyph?: string }[];
  value?: string;
  onSelect: (label: string) => void;
  onClose: () => void;
};

/** Design "select" sheet: the field's icon and name, then pill options with their own icons; the chosen one is blue with a tick. */
export function SelectSheet({ visible, title, glyph = 'f-tag', options, value, onSelect, onClose }: SelectSheetProps) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 18) }]} onPress={(e) => e.stopPropagation()}>
          <View style={styles.grabber} />
          <View style={styles.head}>
            <View style={styles.headLeft}>
              <IconGlyph glyph={glyph} size={22} bg="transparent" scale={0.86} />
              <T style={styles.title}>{title}</T>
            </View>
            <Pressable onPress={onClose} hitSlop={10} style={styles.close} accessibilityLabel="Close">
              <IconGlyph glyph="close" size={32} bg="transparent" fg="#5F5A55" scale={0.44} />
            </Pressable>
          </View>
          <ScrollView style={styles.list} contentContainerStyle={styles.wrap}>
            {options.map((o) => {
              const on = o.label === value;
              const ink = on ? Colors.accent : '#333333';
              return (
                <Pressable
                  key={o.label}
                  onPress={() => {
                    onSelect(o.label);
                    onClose();
                  }}
                  style={[styles.pill, on ? styles.pillOn : styles.pillOff]}>
                  <IconGlyph glyph={o.glyph ?? glyph} size={18} bg="transparent" fg={ink} scale={0.95} />
                  <T style={[styles.pillText, { color: ink }]}>{o.label}</T>
                  <View style={{ opacity: on ? 1 : 0 }}>
                    <IconGlyph glyph="check" size={16} bg="transparent" fg={Colors.accent} scale={1} />
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(20,22,26,0.24)',
  },
  sheet: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 18,
    paddingHorizontal: 16,
  },
  grabber: {
    width: 38,
    height: 4,
    borderRadius: 999,
    backgroundColor: '#DAD7D1',
    alignSelf: 'center',
    marginBottom: 16,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  headLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  title: {
    fontFamily: FontFamily.medium,
    fontSize: 14,
    color: Colors.ink,
  },
  close: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F2F0EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    marginTop: 16,
    maxHeight: 320,
  },
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    padding: 2,
  },
  pill: {
    height: 46,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 18,
    borderRadius: 999,
    borderWidth: 0.5,
  },
  pillOn: {
    backgroundColor: Colors.accentSoft,
    borderColor: 'rgba(19,75,156,0.4)',
  },
  pillOff: {
    backgroundColor: '#F7F9FC',
    borderColor: 'rgba(20,22,26,0.1)',
  },
  pillText: {
    fontFamily: FontFamily.medium,
    fontSize: 14,
  },
});
