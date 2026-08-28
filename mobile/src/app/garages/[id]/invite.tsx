import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { ModalHeader } from '@/components/ui/ModalHeader';
import { Screen } from '@/components/ui/Screen';
import { TextField } from '@/components/ui/TextField';
import { T } from '@/components/ui/Typography';
import { useGarageMembers } from '@/data/hooks';
import { inviteGarageMember } from '@/data/repo';
import { Colors, Spacing } from '@/theme/tokens';

const SEAT_LIMIT = 4;

export default function InviteMemberScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const membersQuery = useGarageMembers(id);
  const memberCount = membersQuery.data?.length ?? 0;
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSave = name.trim().length > 0 && contact.trim().length > 0;

  const handleSave = async () => {
    if (!canSave || !id) return;
    setSaving(true);
    setError(null);
    try {
      await inviteGarageMember(id, { name: name.trim(), email: contact.trim() });
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen
      footer={
        <Button disabled={!canSave} loading={saving} onPress={handleSave}>
          {name.trim().length === 0 ? 'Enter a name' : 'Send invite'}
        </Button>
      }>
      <ModalHeader eyebrow="MEMBERS" />

      <T variant="eyebrow" style={styles.seats}>
        {memberCount} OF {SEAT_LIMIT} SEATS USED
      </T>
      <T variant="subheading" style={styles.heading}>
        Invite someone to this garage
      </T>

      <View style={styles.form}>
        <TextField label="NAME" value={name} onChangeText={setName} placeholder="Full name" autoFocus />
        <TextField label="PHONE OR EMAIL" value={contact} onChangeText={setContact} placeholder="+254... or name@email.com" />
      </View>

      <T variant="meta" color={Colors.textMuted} style={styles.explainer}>
        They join as a member: they can add records and see history, but cannot invite, remove or delete. You can change this later.
      </T>

      {error ? (
        <T variant="body" color={Colors.danger} center style={styles.error}>
          {error}
        </T>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  seats: {
    marginTop: Spacing.sm,
  },
  heading: {
    marginTop: Spacing.xs,
    marginBottom: Spacing.lg,
  },
  form: {
    gap: Spacing.md,
  },
  explainer: {
    marginTop: Spacing.lg,
  },
  error: {
    marginTop: Spacing.sm,
  },
});
