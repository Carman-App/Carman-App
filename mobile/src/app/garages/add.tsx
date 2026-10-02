import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { ScreenTitle } from '@/components/ui/Blocks';
import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { TextField } from '@/components/ui/TextField';
import { T } from '@/components/ui/Typography';
import { TopBar } from '@/components/ui/TopBar';
import { useActiveGarage } from '@/data/hooks';
import { addGarage, inviteGarageMember } from '@/data/repo';
import { setUiState } from '@/data/uiState';
import { InvitePanel, inviteList, type InviteState } from '@/features/garage/InvitePanel';
import { Colors, Spacing } from '@/theme/tokens';

/** New garage: named first, because it is the container vehicles and people are added to. Then who else uses it. */
export default function NewGarageScreen() {
  const current = useActiveGarage().data;
  const [step, setStep] = useState<1 | 2>(1);
  const [name, setName] = useState('');
  const [invites, setInvites] = useState<InviteState>({ email: '', carry: {} });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const list = inviteList(invites);

  const create = async (withMembers: boolean) => {
    setSaving(true);
    setError(null);
    try {
      const garage = await addGarage({ name: name.trim(), location: current?.location || 'Not set' });
      if (withMembers) for (const p of list) await inviteGarageMember(garage.id, p);
      await setUiState({ homeVehicleId: null });
      router.replace('/home');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create the garage.');
      setSaving(false);
    }
  };

  return (
    <Screen
      padded={false}
      header={
        <TopBar
          backGlyph={step === 1 ? 'close' : 'back'}
          onBack={step === 2 ? () => setStep(1) : undefined}
          title="New garage"
          right={<T variant="eyebrow" color={Colors.body}>STEP <T variant="eyebrow" color={Colors.accent}>0{step}</T> / 02</T>}
        />
      }
      footer={
        <>
          {error ? (
            <T variant="meta" color={Colors.danger} center>
              {error}
            </T>
          ) : null}
          {step === 1 ? (
            <Button disabled={!name.trim()} onPress={() => setStep(2)}>
              Continue
            </Button>
          ) : (
            <>
              <Button loading={saving} disabled={list.length === 0} onPress={() => create(true)}>
                Create garage
              </Button>
              <Pressable disabled={saving} onPress={() => create(false)} hitSlop={8}>
                <T variant="meta" color={Colors.accent} center>
                  Create without members
                </T>
              </Pressable>
            </>
          )}
        </>
      }>
      {step === 1 ? (
        <View style={{ paddingHorizontal: Spacing.lg }}>
          <ScreenTitle title="Name the garage" lede="A garage holds vehicles and the people you share them with. You can move a vehicle between garages later." />
          <TextField value={name} onChangeText={setName} placeholder="Garage name" autoFocus autoCapitalize="words" />
        </View>
      ) : (
        <>
          <View style={{ paddingHorizontal: Spacing.lg }}>
            <ScreenTitle title="Who else uses it?" lede="Members see the vehicles and add records. You stay the only one who can remove them." />
          </View>
          <InvitePanel value={invites} onChange={setInvites} />
        </>
      )}
    </Screen>
  );
}
