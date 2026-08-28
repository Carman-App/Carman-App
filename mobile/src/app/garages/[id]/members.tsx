import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { T } from '@/components/ui/Typography';
import { QueryBoundary } from '@/components/data/QueryBoundary';
import { useAccount, useGarage, useGarageMembers } from '@/data/hooks';
import { removeGarageMember, updateGarageMemberRole } from '@/data/repo';
import { formatDateShort } from '@/lib/format';
import { Colors, Radius, Spacing } from '@/theme/tokens';

const ROLE_LABEL: Record<string, string> = {
  owner: 'OWNER',
  member: 'MEMBER',
  pending: 'PENDING',
};

const SEAT_LIMIT = 4;

export default function GarageMembersScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const garageQuery = useGarage(id);
  const membersQuery = useGarageMembers(id);
  const accountQuery = useAccount();
  const account = accountQuery.data;
  const garage = garageQuery.data;
  const seatsLeft = Math.max(0, SEAT_LIMIT - (membersQuery.data?.length ?? 0));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const handleMakeOwner = async (memberId: string) => {
    if (!id) return;
    setBusyId(memberId);
    await updateGarageMemberRole(id, memberId, 'owner');
    setBusyId(null);
    setSelectedId(null);
  };

  const handleRemove = async (memberId: string) => {
    if (!id) return;
    setBusyId(memberId);
    await removeGarageMember(id, memberId);
    setBusyId(null);
    setSelectedId(null);
  };

  return (
    <Screen scroll contentStyle={styles.content}>
      <Pressable onPress={() => router.back()}>
        <T variant="eyebrowStrong" color={Colors.accent}>
          ← BACK
        </T>
      </Pressable>

      <T variant="eyebrow" style={styles.eyebrow}>
        {membersQuery.data?.length ?? 0} OF {SEAT_LIMIT} SEATS USED
      </T>
      <T variant="display" style={styles.title}>
        {garage?.name ?? ''}
      </T>
      <T variant="body" color={Colors.textMuted} style={styles.sub}>
        Members add records and see history. Owners can invite, change roles and remove people. Tap anyone to manage them.
      </T>

      <QueryBoundary
        query={membersQuery}
        empty={{ glyph: 'member', title: 'No members yet', body: 'Invite someone to this garage to see them here.' }}>
        {(members) => (
          <Card padded={false} style={styles.card}>
            {members.map((m, i) => {
              const isSelected = selectedId === m.id;
              const canManage = m.role !== 'owner';
              return (
                <View key={m.id} style={i < members.length - 1 ? styles.rowBordered : undefined}>
                  <Pressable
                    style={styles.row}
                    onPress={() => canManage && setSelectedId(isSelected ? null : m.id)}>
                    <Avatar name={m.name} />
                    <View style={styles.rowText}>
                      <T variant="bodyStrong">{m.name}</T>
                      <T variant="meta">
                        {ROLE_LABEL[m.role] ?? m.role.toUpperCase()} ·{' '}
                        {account?.email && m.email === account.email ? 'YOU' : m.joinedAt ? `JOINED ${formatDateShort(m.joinedAt)}` : 'NOT JOINED YET'}
                      </T>
                    </View>
                    <View style={styles.badge}>
                      <T variant="eyebrow" color={m.role === 'owner' ? Colors.accent : Colors.textMuted}>
                        {ROLE_LABEL[m.role] ?? m.role.toUpperCase()}
                      </T>
                    </View>
                  </Pressable>
                  {isSelected ? (
                    <View style={styles.actions}>
                      <Button
                        size="md"
                        variant="secondary"
                        style={styles.actionBtn}
                        loading={busyId === m.id}
                        onPress={() => handleMakeOwner(m.id)}>
                        Make owner
                      </Button>
                      <Button
                        size="md"
                        variant="danger"
                        style={styles.actionBtn}
                        loading={busyId === m.id}
                        onPress={() => handleRemove(m.id)}>
                        Remove
                      </Button>
                    </View>
                  ) : null}
                </View>
              );
            })}
          </Card>
        )}
      </QueryBoundary>

      <T variant="meta" style={styles.footnote}>
        {seatsLeft > 0
          ? `${seatsLeft} SEAT${seatsLeft === 1 ? '' : 'S'} LEFT · ADDITIONAL MEMBER USD $1/MONTH`
          : 'NO SEATS LEFT · ADDITIONAL MEMBER USD $1/MONTH'}
      </T>

      <Button variant="ghost" style={styles.inviteBtn} onPress={() => garage && router.push(`/garages/${garage.id}/invite`)}>
        + Invite member
      </Button>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: Spacing.sm,
  },
  eyebrow: {
    marginTop: Spacing.md,
  },
  title: {
    marginTop: Spacing.xxs,
  },
  sub: {
    marginTop: Spacing.xs,
    marginBottom: Spacing.lg,
  },
  card: {
    padding: Spacing.sm,
    marginBottom: Spacing.md,
  },
  rowBordered: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xs,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  badge: {
    backgroundColor: Colors.surfaceMuted,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.xs,
    paddingBottom: Spacing.sm,
  },
  actionBtn: {
    flex: 1,
  },
  footnote: {
    marginBottom: Spacing.lg,
  },
  inviteBtn: {
    marginBottom: Spacing.xl,
  },
});
