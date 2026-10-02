import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { ScreenTitle } from '@/components/ui/Blocks';
import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { TextField } from '@/components/ui/TextField';
import { T } from '@/components/ui/Typography';
import { TopBar } from '@/components/ui/TopBar';
import { createWorkshopCustomer, useActiveWorkshop } from '@/data/hooks';
import { Colors, Spacing } from '@/theme/tokens';

/** Add a customer: a name and a phone number is enough to start. */
export default function AddCustomerScreen() {
  const workshop = useActiveWorkshop().data;
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (!workshop) return;
    setSaving(true);
    setError(null);
    try {
      await createWorkshopCustomer(workshop.id, { name: name.trim(), phone: phone.trim() || undefined, notes: notes.trim() || undefined });
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not add the customer.');
      setSaving(false);
    }
  };

  return (
    <Screen
      header={<TopBar backGlyph="close" title="Add a customer" />}
      footer={
        <>
          {error ? (
            <T variant="meta" color={Colors.danger} center>
              {error}
            </T>
          ) : null}
          <Button disabled={name.trim().length < 2} loading={saving} onPress={save}>
            Add the customer
          </Button>
        </>
      }>
      <ScreenTitle title="Who is it?" lede="Their vehicle and the job come next." />
      <View style={{ gap: Spacing.sm }}>
        <TextField value={name} onChangeText={setName} placeholder="Full name" autoFocus autoCapitalize="words" />
        <TextField value={phone} onChangeText={setPhone} placeholder="Phone" keyboardType="phone-pad" />
        <TextField value={notes} onChangeText={setNotes} placeholder="Notes · optional" multiline />
      </View>
    </Screen>
  );
}
