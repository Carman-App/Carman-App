import { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { HugeiconsIcon } from '@hugeicons/react-native';
import Cancel01Icon from '@hugeicons/core-free-icons/Cancel01Icon';
import Tick02Icon from '@hugeicons/core-free-icons/Tick02Icon';
import Search01Icon from '@hugeicons/core-free-icons/Search01Icon';

import { FieldRow } from '@/components/ui/TextField';
import { T } from '@/components/ui/Typography';
import { Colors, FontFamily, Radius, Spacing } from '@/theme/tokens';

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
  return <FieldRow label={label} value={value} onPress={onPress} />;
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
          <View style={styles.headerRow}>
            <View style={styles.headerText}>
              <T variant="display">{title}</T>
              {hint ? (
                <T variant="eyebrow" style={styles.hint}>
                  {hint}
                </T>
              ) : null}
            </View>
            <Pressable onPress={handleClose} hitSlop={10} style={styles.closeBtn} accessibilityLabel="Close">
              <HugeiconsIcon icon={Cancel01Icon} size={22} color={Colors.slate} />
            </Pressable>
          </View>

          <View style={styles.searchWrap}>
            <HugeiconsIcon icon={Search01Icon} size={18} color={Colors.slate} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={searchPlaceholder}
              placeholderTextColor={Colors.textFaint}
              style={styles.searchInput}
              autoCorrect={false}
              autoCapitalize="none"
            />
          </View>

          <T variant="eyebrow" color={Colors.textFaint} style={styles.count}>
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
                  <T variant="bodyStrong" color={active ? Colors.accent : Colors.body} style={styles.rowLabel}>
                    {item}
                  </T>
                  {active ? <HugeiconsIcon icon={Tick02Icon} size={18} color={Colors.accent} /> : null}
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
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: Colors.scrim,
  },
  sheet: {
    maxHeight: '84%',
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    paddingBottom: Spacing.xl,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: 14,
  },
  headerText: {
    flex: 1,
    gap: 4,
  },
  hint: {
    marginTop: 2,
  },
  closeBtn: {
    padding: 4,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.line,
    borderRadius: Radius.pill,
    paddingHorizontal: 18,
    paddingVertical: 4,
  },
  searchInput: {
    outlineWidth: 0,
    flex: 1,
    fontFamily: FontFamily.medium,
    fontSize: 16,
    color: Colors.body,
    paddingVertical: 9,
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
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderSoft,
  },
  rowLabel: {
    flex: 1,
  },
  empty: {
    paddingVertical: Spacing.lg,
    textAlign: 'center',
  },
});
