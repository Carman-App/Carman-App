import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { ScreenTitle } from '@/components/ui/Blocks';
import { Screen } from '@/components/ui/Screen';
import { T } from '@/components/ui/Typography';
import { TopBar } from '@/components/ui/TopBar';
import { useGarage } from '@/data/hooks';
import { inviteGarageMember } from '@/data/repo';
import { InvitePanel, inviteList, type InviteState } from '@/features/garage/InvitePanel';
import { Colors, Spacing } from '@/theme/tokens';

/** Invite members: people already in your other garage carried over in one tap, or invited by email. */
export default function InviteMembersScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const garage = useGarage(id).data;
  const [state, setState] = useState<InviteState>({ email: '', carry: {} });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const list = inviteList(state);

  const send = async () => {
    setSaving(true);
    setError(null);
    try {
      for (const p of list) await inviteGarageMember(id, p);
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send the invite.');
      setSaving(false);
    }
  };

  return (
    <Screen
      padded={false}
      header={<TopBar title="Invite members" right={garage?.name} />}
      footer={
        <>
          {error ? (
            <T variant="meta" color={Colors.danger} center>
              {error}
            </T>
          ) : null}
          <Button disabled={list.length === 0} loading={saving} onPress={send}>
            {list.length > 1 ? `Invite ${list.length} people` : 'Send invite'}
          </Button>
        </>
      }>
      <View style={{ paddingHorizontal: Spacing.lg }}>
        <ScreenTitle title="Who else uses it?" lede="Members see the vehicles and add records. You stay the only one who can remove them." />
      </View>
      <InvitePanel excludeGarageId={id} value={state} onChange={setState} />
    </Screen>
  );
}
