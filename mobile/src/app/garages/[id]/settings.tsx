import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { IconGlyph } from '@/components/ui/IconGlyph';
import { Screen } from '@/components/ui/Screen';
import { TextField } from '@/components/ui/TextField';
import { T } from '@/components/ui/Typography';
import { TopBar } from '@/components/ui/TopBar';
import { useAccount, useGarage, useGarageMembers } from '@/data/hooks';
import { removeGarageMember, updateGarage } from '@/data/repo';
import { MemberRow } from '@/features/garage/MemberRow';
import { Colors, Spacing } from '@/theme/tokens';

/** Garage settings: rename the garage, remove a member, invite someone. */
export default function GarageSettingsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const garage = useGarage(id).data;
  const account = useAccount().data;
  const members = useGarageMembers(id).data ?? [];
  const [draftName, setName] = useState<string | null>(null);
  const name = draftName ?? garage?.name ?? '';
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const changed = !!garage && name.trim().length > 0 && name.trim() !== garage.name;
  // Seats come from the plan (Personal 3, Pro 10…); pending invites hold a seat. null = no limit.
  const seatLimit = account?.planState?.limits.seats ?? null;
  const seats = seatLimit === null ? null : Math.max(0, seatLimit - members.length);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await updateGarage(id, { name: name.trim() });
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save.');
    } finally {
      setSaving(false);
    }
  };

  const remove = (memberId: string, memberName: string) =>
    Alert.alert(`Remove ${memberName}?`, 'They lose access to this garage. Records they added stay.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => void removeGarageMember(id, memberId) },
    ]);

  return (
    <Screen
      padded={false}
      header={<TopBar title="Garage settings" right="Owner" />}
      headerRule
      footer={
        <>
          {error ? (
            <T variant="meta" color={Colors.danger} center>
              {error}
            </T>
          ) : null}
          <Button disabled={!changed} loading={saving} onPress={save}>
            Save changes
          </Button>
        </>
      }>
      <View style={styles.block}>
        <T variant="section">Garage name</T>
        <TextField value={name} onChangeText={setName} placeholder="Garage name" glyph="garage-door" />
        <T variant="meta">Everyone in the garage sees this name. The vehicles and records inside are untouched.</T>
      </View>
      <View style={styles.membersHead}>
        <T variant="section">Members</T>
        <T variant="meta">
          {members.length} {members.length === 1 ? 'person' : 'people'}
          {seats === null ? '' : ` · ${seats} seat${seats === 1 ? '' : 's'} left`}
        </T>
      </View>
      {members.map((m) => (
        <MemberRow key={m.id} member={m} isYou={m.name === account?.name} onRemove={m.role !== 'owner' ? () => remove(m.id, m.name) : undefined} />
      ))}
      <View style={styles.invite}>
        <Button variant="secondary" size="md" glyph="user-add" onPress={() => router.push(`/garages/${id}/invite`)}>
          Invite someone
        </Button>
      </View>
      <Pressable accessibilityRole="button" onPress={() => router.push(`/garages/${id}/members`)} style={styles.link}>
        <IconGlyph glyph="members" size={32} shape="tile" bg={Colors.tealSoft} fg={Colors.teal} />
        <View style={styles.flex}>
          <T variant="bodyStrong">What the roles can do</T>
          <T variant="meta">Owner, Member and Pending, explained</T>
        </View>
        <IconGlyph glyph="chevron-right" size={20} bg="transparent" fg={Colors.textFaint} />
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  block: {
    padding: Spacing.lg,
    gap: 14,
  },
  membersHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    paddingHorizontal: Spacing.lg,
    paddingTop: 18,
    paddingBottom: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  invite: {
    padding: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.borderSoft,
  },
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  flex: {
    flex: 1,
    gap: 4,
  },
});
