import { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { HugeiconsIcon } from '@hugeicons/react-native';
import ArrowDown01Icon from '@hugeicons/core-free-icons/ArrowDown01Icon';
import Search01Icon from '@hugeicons/core-free-icons/Search01Icon';

import { T } from '@/components/ui/Typography';
import { Colors, Radius, Spacing } from '@/theme/tokens';

/**
 * Bottom-sheet picker matching the prototype's MAKE/MODEL/YEAR picker sheet:
 * tap a field to open a sheet with a search box that filters the option list
 * live, tap a row to select and close. Reused wherever a field needs to pick
 * one value out of a (possibly long) list rather than free-text entry.
 */

type PickerFieldProps = {
  label: string;
  value: string;
  onPress: () => void;
};

/** The tappable field row that opens a PickerSheet — same visual language as TextField, but non-editable. */
export function PickerField({ label, value, onPress }: PickerFieldProps) {
  return (
    <Pressable onPress={onPress} style={styles.fieldWrap}>
      <T variant="eyebrow">{label}</T>
      <View style={styles.fieldRow}>
        <T variant="subheading" style={styles.fieldValue} numberOfLines={1}>
          {value}
        </T>
        <HugeiconsIcon icon={ArrowDown01Icon} size={18} color={Colors.text} />
      </View>
    </Pressable>
  );
}

type PickerSheetProps = {
  visible: boolean;
  title: string;
  hint?: string;
  items: string[];
  selected?: string;
  onSelect: (value: string) => void;
  onClose: () => void;
  searchPlaceholder?: string;
};

export function PickerSheet({
  visible,
  title,
  hint,
  items,
  selected,
  onSelect,
  onClose,
  searchPlaceholder = 'Type to filter',
}: PickerSheetProps) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? items.filter((item) => item.toLowerCase().includes(q)) : items;
  }, [items, query]);

  const handleClose = () => {
    setQuery('');
    onClose();
  };

  const handlePick = (value: string) => {
    setQuery('');
    onSelect(value);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <Pressable style={styles.backdrop} onPress={handleClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.grabber} />
          <View style={styles.headerRow}>
            <View style={styles.headerText}>
              <T variant="heading">{title}</T>
              {hint ? (
                <T variant="eyebrow" style={styles.hint}>
                  {hint}
                </T>
              ) : null}
            </View>
            <Pressable onPress={handleClose} hitSlop={10} style={styles.closeBtn}>
              <T variant="eyebrowStrong" color={Colors.textMuted}>
                CLOSE
              </T>
            </Pressable>
          </View>

          <View style={styles.searchWrap}>
            <HugeiconsIcon icon={Search01Icon} size={18} color={Colors.textMuted} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={searchPlaceholder}
              placeholderTextColor={Colors.placeholder}
              style={styles.searchInput}
              autoCorrect={false}
              autoCapitalize="none"
            />
          </View>

          <T variant="meta" color={Colors.textMuted} style={styles.count}>
            {filtered.length} OF {items.length}
          </T>

          <FlatList
            data={filtered}
            keyExtractor={(item) => item}
            style={styles.list}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => {
              const active = item === selected;
              return (
                <Pressable style={styles.row} onPress={() => handlePick(item)}>
                  <T variant={active ? 'bodyStrong' : 'body'} color={active ? Colors.accent : Colors.text} style={styles.rowLabel}>
                    {item}
                  </T>
                  <T variant="eyebrowStrong" color={active ? Colors.accent : Colors.textMuted}>
                    SELECT
                  </T>
                </Pressable>
              );
            }}
            ListEmptyComponent={
              <T variant="body" color={Colors.textMuted} style={styles.empty}>
                No matches.
              </T>
            }
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fieldWrap: {
    gap: Spacing.xs,
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.xs,
    borderBottomWidth: 1.5,
    borderBottomColor: Colors.border,
    paddingBottom: Spacing.xs,
  },
  fieldValue: {
    flex: 1,
  },
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(20,19,17,0.34)',
  },
  sheet: {
    maxHeight: '76%',
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    paddingBottom: Spacing.xl,
  },
  grabber: {
    alignSelf: 'center',
    width: 38,
    height: 4,
    borderRadius: Radius.pill,
    backgroundColor: Colors.disabledTrack,
    marginTop: Spacing.sm,
    marginBottom: Spacing.xxs,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xs,
    paddingBottom: Spacing.sm,
  },
  headerText: {
    flex: 1,
    gap: 2,
  },
  hint: {
    marginTop: 2,
  },
  closeBtn: {
    paddingTop: Spacing.xxs,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.xs,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: Colors.text,
  },
  count: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.xxs,
  },
  list: {
    paddingHorizontal: Spacing.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderLight,
  },
  rowLabel: {
    flex: 1,
  },
  empty: {
    paddingVertical: Spacing.lg,
    textAlign: 'center',
  },
});
