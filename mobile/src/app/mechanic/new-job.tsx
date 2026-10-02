import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ScreenTitle } from '@/components/ui/Blocks';
import { Button } from '@/components/ui/Button';
import { ChoiceRow } from '@/components/ui/ChoiceRow';
import { Screen } from '@/components/ui/Screen';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { TextField } from '@/components/ui/TextField';
import { T } from '@/components/ui/Typography';
import { TopBar } from '@/components/ui/TopBar';
import { createJob, createWorkshopCustomer, useActiveWorkshop, useWorkshopCustomers } from '@/data/hooks';
import { Colors, Spacing } from '@/theme/tokens';

/** New job: a customer (existing or new), their vehicle, and the problem in their words. */
export default function NewJobScreen() {
  const workshop = useActiveWorkshop().data;
  const customers = useWorkshopCustomers(workshop?.id ?? undefined).data ?? [];
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [vehicle, setVehicle] = useState('');
  const [fault, setFault] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isNew = customerId === null;
  const ok = !!workshop && (isNew ? name.trim().length > 1 : true) && fault.trim().length > 2;

  const open = async () => {
    if (!workshop) return;
    setSaving(true);
    setError(null);
    try {
      const cid = isNew ? (await createWorkshopCustomer(workshop.id, { name: name.trim(), phone: phone.trim() || undefined })).id : customerId!;
      const job = await createJob(workshop.id, { customerId: cid, vehicleDescription: vehicle.trim() || undefined, faultDescription: fault.trim() });
      router.replace({ pathname: '/mechanic/job-detail', params: { id: job.id } });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not open the job.');
      setSaving(false);
    }
  };

  return (
    <Screen
      padded={false}
      header={<TopBar backGlyph="close" title="New job" right={workshop?.name} />}
      footer={
        <>
          {error ? (
            <T variant="meta" color={Colors.danger} center>
              {error}
            </T>
          ) : null}
          <Button disabled={!ok} loading={saving} onPress={open}>
            Open the job
          </Button>
        </>
      }>
      <View style={styles.pad}>
        <ScreenTitle title="Who and what?" lede="A name and the problem in the owner’s words is enough. Lines and the estimate come next." />
      </View>
      <SectionHeader title="CUSTOMER" rule inset />
      <ChoiceRow glyph="user-add" title="A new customer" selected={isNew} onPress={() => setCustomerId(null)} />
      {isNew ? (
        <View style={styles.fields}>
          <TextField value={name} onChangeText={setName} placeholder="Full name" autoCapitalize="words" />
          <TextField value={phone} onChangeText={setPhone} placeholder="Phone · optional" keyboardType="phone-pad" />
        </View>
      ) : null}
      {customers.map((c) => (
        <ChoiceRow key={c.id} glyph="members" title={c.name} sub={c.phone ?? undefined} selected={customerId === c.id} onPress={() => setCustomerId(c.id)} />
      ))}
      <SectionHeader title="VEHICLE AND PROBLEM" rule inset />
      <View style={styles.fields}>
        <TextField label="Vehicle" value={vehicle} onChangeText={setVehicle} placeholder="Toyota Prado · KDG 441X" />
        <TextField label="Reported problem" value={fault} onChangeText={setFault} placeholder="Grinding at the front when braking downhill" multiline />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: Spacing.lg },
  fields: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, gap: 12 },
});
