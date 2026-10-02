import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Screen } from '@/components/ui/Screen';
import { TextField } from '@/components/ui/TextField';
import { T } from '@/components/ui/Typography';
import { TopBar } from '@/components/ui/TopBar';
import { addJobLine, useCurrency, useJob, type JobLineKind } from '@/data/hooks';
import { Colors, Spacing } from '@/theme/tokens';

const KINDS: { key: JobLineKind; label: string }[] = [
  { key: 'PART', label: 'Part' },
  { key: 'LABOUR', label: 'Labour' },
  { key: 'SERVICE', label: 'Service' },
  { key: 'FLUID', label: 'Fluid' },
];

/** One job line. Parts and labour stay separate lines, so the owner sees what each costs. */
export default function AddJobLineScreen() {
  const { jobId } = useLocalSearchParams<{ jobId: string }>();
  const job = useJob(jobId).data;
  const currency = useCurrency();
  const [kind, setKind] = useState<JobLineKind>('PART');
  const [description, setDescription] = useState('');
  const [hours, setHours] = useState('');
  const [rate, setRate] = useState('2400');
  const [cost, setCost] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const labourCost = kind === 'LABOUR' && hours ? Math.round(Number(hours) * Number(rate || 0)) : undefined;
  const amount = labourCost ?? Number(cost.replace(/,/g, ''));
  const ok = !!job && description.trim().length > 1 && amount > 0;

  const save = async (another: boolean) => {
    if (!job) return;
    setSaving(true);
    setError(null);
    try {
      const desc = kind === 'LABOUR' && hours ? `${description.trim()} · ${hours} h at ${rate}` : description.trim();
      await addJobLine(job, { kind, description: desc, cost: amount });
      if (another) {
        setDescription('');
        setCost('');
        setHours('');
        setSaving(false);
      } else router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not add the line.');
      setSaving(false);
    }
  };

  return (
    <Screen
      header={<TopBar backGlyph="close" title="Add a line" right={job?.customer?.name} />}
      footer={
        <>
          {error ? (
            <T variant="meta" color={Colors.danger} center>
              {error}
            </T>
          ) : null}
          <Button disabled={!ok} loading={saving} onPress={() => save(false)}>
            Add the line
          </Button>
          <Button variant="ghost" size="md" disabled={!ok || saving} onPress={() => save(true)}>
            Add and start another
          </Button>
        </>
      }>
      <View style={styles.body}>
        <View style={styles.chips}>
          {KINDS.map((k) => (
            <Chip key={k.key} label={k.label} selected={kind === k.key} onPress={() => setKind(k.key)} />
          ))}
        </View>
        <TextField label="What" value={description} onChangeText={setDescription} placeholder={kind === 'LABOUR' ? 'Brake service' : 'Front brake pads · Bosch BP1428'} autoFocus />
        {kind === 'LABOUR' ? (
          <View style={styles.row}>
            <TextField label="Hours" value={hours} onChangeText={setHours} placeholder="2.0" keyboardType="decimal-pad" style={styles.flex} />
            <TextField label="Rate" value={rate} onChangeText={setRate} prefix={currency} keyboardType="number-pad" style={styles.flex} />
          </View>
        ) : null}
        {labourCost === undefined ? (
          <TextField label="Cost" value={cost} onChangeText={setCost} placeholder="0" prefix={currency} keyboardType="decimal-pad" emphasis />
        ) : (
          <T variant="lede">
            {currency} {labourCost.toLocaleString()} for this line
          </T>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { paddingTop: Spacing.md, gap: Spacing.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  row: { flexDirection: 'row', gap: Spacing.sm },
  flex: { flex: 1 },
});
