import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { IconGlyph } from '@/components/ui/IconGlyph';
import { Screen } from '@/components/ui/Screen';
import { TextField } from '@/components/ui/TextField';
import { T } from '@/components/ui/Typography';
import { TopBar } from '@/components/ui/TopBar';
import { api } from '@/data/api/client';
import { useAccount, useActiveWorkshop } from '@/data/hooks';
import { Colors, Spacing } from '@/theme/tokens';

type Role = 'OWNER' | 'MECHANIC' | 'FRONTDESK' | 'APPRENTICE';
type Teammate = { id: string; accountId: string; role: Role; displayName: string; email: string };

const ROLE_LABEL: Record<Role, string> = { OWNER: 'Owner', MECHANIC: 'Mechanic', FRONTDESK: 'Front desk', APPRENTICE: 'Apprentice' };
const ROLE_NOTE: Record<Exclude<Role, 'OWNER'>, string> = {
  MECHANIC: 'Works jobs, adds lines and inspections.',
  FRONTDESK: 'Books jobs in, talks to customers, takes payments.',
  APPRENTICE: 'Works on jobs they are put on.',
};
const ADDABLE = ['MECHANIC', 'FRONTDESK', 'APPRENTICE'] as const;

/**
 * Workshop team (spec roles: owner, mechanic, front desk, apprentice). The
 * owner adds someone by the email they use for Carma, picks their role, and
 * can change or remove it. Staff count against the plan's staff limit.
 */
export default function TeamScreen() {
  const workshop = useActiveWorkshop().data;
  const account = useAccount().data;
  const qc = useQueryClient();
  const key = ['workshop-team', workshop?.id] as const;
  const team = useQuery({ queryKey: key, queryFn: () => api.get<Teammate[]>(`workshops/${workshop!.id}/members`), enabled: !!workshop });
  const isOwner = !!team.data && team.data.some((m) => m.role === 'OWNER' && m.accountId === account?.id);

  const [email, setEmail] = useState('');
  const [role, setRole] = useState<(typeof ADDABLE)[number]>('MECHANIC');
  const [error, setError] = useState<string | null>(null);

  const refresh = () => qc.invalidateQueries({ queryKey: key });
  const add = useMutation({
    mutationFn: () => api.post(`workshops/${workshop!.id}/members`, { email: email.trim(), role }),
    onSuccess: () => {
      setEmail('');
      setError(null);
      void refresh();
    },
    onError: (e) => setError(e instanceof Error ? e.message : 'Could not add them.'),
  });

  const changeRole = (m: Teammate) =>
    Alert.alert(m.displayName, 'Change their role', [
      ...ADDABLE.filter((r) => r !== m.role).map((r) => ({
        text: ROLE_LABEL[r],
        onPress: () => void api.patch(`workshops/${workshop!.id}/members/${m.id}`, { role: r }).then(refresh),
      })),
      { text: 'Remove from the team', style: 'destructive' as const, onPress: () => void api.delete(`workshops/${workshop!.id}/members/${m.id}`).then(refresh) },
      { text: 'Cancel', style: 'cancel' as const },
    ]);

  const validEmail = /^\S+@\S+\.\S+$/.test(email.trim());

  return (
    <Screen
      header={<TopBar backLabel="DASHBOARD" right={workshop?.name?.toUpperCase() ?? 'TEAM'} />}
      footer={
        isOwner ? (
          <>
            {error ? (
              <T variant="meta" color={Colors.danger} center>
                {error}
              </T>
            ) : null}
            <Button disabled={!validEmail} loading={add.isPending} onPress={() => add.mutate()} glyph="user-add">
              {`Add as ${ROLE_LABEL[role].toLowerCase()}`}
            </Button>
          </>
        ) : null
      }>
      <T variant="display" style={styles.title}>
        Team
      </T>
      {(team.data ?? []).map((m) => (
        <Pressable
          key={m.id}
          accessibilityRole="button"
          accessibilityLabel={`${m.displayName}, ${ROLE_LABEL[m.role]}`}
          disabled={!isOwner || m.role === 'OWNER'}
          onPress={() => changeRole(m)}
          style={styles.row}>
          <Avatar name={m.displayName} size={40} />
          <View style={styles.flex}>
            <T variant="bodyStrong" numberOfLines={1}>
              {m.displayName}
              {m.accountId === account?.id ? ' (you)' : ''}
            </T>
            <T variant="meta" numberOfLines={1}>
              {m.email}
            </T>
          </View>
          <T variant="meta" color={m.role === 'OWNER' ? Colors.ink : Colors.accent}>
            {ROLE_LABEL[m.role]}
          </T>
          {isOwner && m.role !== 'OWNER' ? <IconGlyph glyph="chevron-right" size={20} bg="transparent" fg={Colors.textFaint} /> : null}
        </Pressable>
      ))}

      {isOwner ? (
        <View style={styles.add}>
          <T variant="section">Add someone</T>
          <TextField label="Their email" value={email} onChangeText={setEmail} placeholder="name@example.com" keyboardType="email-address" autoCapitalize="none" glyph="mail" />
          <View style={styles.chips}>
            {ADDABLE.map((r) => (
              <Chip key={r} label={ROLE_LABEL[r]} selected={role === r} onPress={() => setRole(r)} />
            ))}
          </View>
          <T variant="meta">{ROLE_NOTE[role]} They need Carma on their phone, signed in with this email.</T>
        </View>
      ) : (
        <T variant="meta" style={styles.add}>
          Only the workshop owner can add or change the team.
        </T>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    paddingTop: Spacing.md,
    paddingBottom: Spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  flex: {
    flex: 1,
  },
  add: {
    paddingTop: Spacing.lg,
    gap: Spacing.md,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
});
