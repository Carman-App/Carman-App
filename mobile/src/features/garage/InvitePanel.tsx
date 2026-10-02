import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { ChoiceRow } from '@/components/ui/ChoiceRow';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { TextField } from '@/components/ui/TextField';
import { useGarageMembers, useGarages } from '@/data/hooks';
import { Spacing } from '@/theme/tokens';
import type { GarageMember } from '@/types/domain';

export type InviteState = { email: string; carry: Record<string, GarageMember> };

/** Shared body of "Who else uses it?": an email field plus people from your other garage, carried over in one tap. */
export function InvitePanel({ excludeGarageId, value, onChange }: { excludeGarageId?: string; value: InviteState; onChange: (v: InviteState) => void }) {
  const garages = useGarages().data ?? [];
  const other = garages.find((g) => g.id !== excludeGarageId);
  const otherMembers = useGarageMembers(other?.id).data ?? [];
  const here = useGarageMembers(excludeGarageId).data ?? [];
  const candidates = useMemo(
    () => otherMembers.filter((m) => m.role !== 'owner' && m.email && !here.some((h) => h.email === m.email)),
    [otherMembers, here]
  );

  return (
    <View>
      <View style={styles.pad}>
        <TextField
          value={value.email}
          onChangeText={(email) => onChange({ ...value, email })}
          placeholder="Email address"
          keyboardType="email-address"
          autoCapitalize="none"
          helper="They get an invite to join as Contribute."
        />
      </View>
      {candidates.length > 0 ? (
        <>
          <SectionHeader title={`FROM ${other?.name.toUpperCase() ?? 'YOUR OTHER GARAGE'}`} inset />
          {candidates.map((m) => (
            <ChoiceRow
              key={m.id}
              multi
              glyph="members"
              title={m.name}
              sub={m.email}
              selected={!!value.carry[m.id]}
              onPress={() => {
                const carry = { ...value.carry };
                if (carry[m.id]) delete carry[m.id];
                else carry[m.id] = m;
                onChange({ ...value, carry });
              }}
            />
          ))}
        </>
      ) : null}
    </View>
  );
}

export function inviteList(v: InviteState): { name: string; email: string }[] {
  const list = Object.values(v.carry).map((m) => ({ name: m.name, email: m.email! }));
  const e = v.email.trim();
  if (/^\S+@\S+\.\S+$/.test(e)) list.unshift({ name: e.split('@')[0], email: e });
  return list;
}

const styles = StyleSheet.create({
  pad: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
  },
});
