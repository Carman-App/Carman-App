import { Pressable, StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/ui/Avatar';
import { IconGlyph } from '@/components/ui/IconGlyph';
import { T } from '@/components/ui/Typography';
import { Colors, FontFamily, Spacing } from '@/theme/tokens';
import type { GarageMember } from '@/types/domain';

const ROLE: Record<GarageMember['role'], { label: string; bg: string; line: string; ink: string }> = {
  owner: { label: 'Owner', bg: Colors.ink, line: Colors.ink, ink: Colors.white },
  member: { label: 'Member', bg: Colors.white, line: Colors.accent, ink: Colors.accent },
  pending: { label: 'Pending', bg: Colors.white, line: Colors.borderStrong, ink: Colors.textMuted },
};

/** A garage member: initials, name and what they do here, the role pill, and (for the owner) remove. */
export function MemberRow({ member, meta, isYou, onRemove, onToggle }: { member: GarageMember; meta?: string; isYou?: boolean; onRemove?: () => void; onToggle?: () => void }) {
  const r = ROLE[member.role];
  return (
    <View style={styles.row}>
      <Avatar name={member.name} size={40} />
      <View style={styles.flex}>
        <T variant="bodyStrong" numberOfLines={1}>
          {member.name}
        </T>
        <T variant="meta">{meta ?? (isYou ? 'You' : member.role === 'pending' ? `Invited · ${member.email ?? ''}` : member.email ?? 'Member')}</T>
      </View>
      <Pressable accessibilityRole="button" disabled={!onToggle} onPress={onToggle} style={[styles.pill, { backgroundColor: r.bg, borderColor: r.line }]}>
        <T style={[styles.pillText, { color: r.ink }]}>{r.label}</T>
      </Pressable>
      {onRemove ? (
        <Pressable accessibilityRole="button" onPress={onRemove} hitSlop={6} style={styles.remove} accessibilityLabel={`Remove ${member.name}`}>
          <IconGlyph glyph="close" size={32} bg="transparent" fg={Colors.signal} scale={0.55} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: Colors.borderSoft,
  },
  flex: {
    flex: 1,
    gap: 4,
  },
  pill: {
    height: 28,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    justifyContent: 'center',
  },
  pillText: {
    fontFamily: FontFamily.medium,
    fontSize: 12,
  },
  remove: {
    marginRight: -8,
  },
});

// The roles the server has (GarageRole OWNER / MEMBER, plus a pending invitation).
export const ROLE_EXPLAINED = [
  { role: 'Owner', body: 'Runs the garage: invites and removes people, changes the plan, and can delete vehicles and the garage.' },
  { role: 'Member', body: 'Adds records, readings and documents, and edits what they added. Cannot remove people or delete the garage.' },
  { role: 'Pending', body: 'Invited but not joined yet. A pending invite holds a seat until it is accepted, declined or expires.' },
];
