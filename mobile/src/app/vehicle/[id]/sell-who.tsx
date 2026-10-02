import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { Footnote } from '@/components/ui/Blocks';
import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { T } from '@/components/ui/Typography';
import { TopBar } from '@/components/ui/TopBar';
import { useCurrency, useVehicle } from '@/data/hooks';
import { Colors, FontFamily, Spacing } from '@/theme/tokens';

/** Who is buying: name and phone get the handover code by text. The price is optional and private. */
export default function SellWhoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const vehicle = useVehicle(id).data;
  const currency = useCurrency();
  const [buyer, setBuyer] = useState('');
  const [phone, setPhone] = useState('');
  const [price, setPrice] = useState('');
  const ready = buyer.trim().length > 1 && phone.trim().length > 5;

  return (
    <Screen
      padded={false}
      header={<TopBar backLabel="TRANSFER" step={{ step: 1, total: 3 }} />}
      footer={
        <Button disabled={!ready} onPress={() => router.push({ pathname: `/vehicle/${id}/sell-what`, params: { buyer: buyer.trim(), phone: phone.trim(), salePrice: price.trim() } })}>
          {ready ? 'Continue' : 'Name and phone first'}
        </Button>
      }>
      <View style={styles.head}>
        <T variant="display">Who is buying the {vehicle?.model ?? 'vehicle'}?</T>
        <T variant="lede">They get a text with the handover code. If they are not on Carma, it walks them through setting up first.</T>
      </View>
      <Field label="BUYER" value={buyer} onChange={setBuyer} placeholder="Full name" />
      <Field label="PHONE" value={phone} onChange={setPhone} placeholder="+254 …" keyboard="phone-pad" />
      <Field label="SALE PRICE" value={price} onChange={setPrice} placeholder="0" keyboard="number-pad" unit={currency} />
      <View style={styles.note}>
        <Footnote>THE SALE PRICE IS OPTIONAL. IT IS KEPT IN YOUR RECORDS AND IS NOT SHOWN TO THE BUYER.</Footnote>
      </View>
    </Screen>
  );
}

function Field({ label, value, onChange, placeholder, keyboard, unit }: { label: string; value: string; onChange: (v: string) => void; placeholder: string; keyboard?: 'phone-pad' | 'number-pad'; unit?: string }) {
  return (
    <View style={styles.field}>
      <T variant="eyebrow" color={Colors.slate} style={styles.fieldLabel}>
        {label}
      </T>
      {unit ? (
        <T variant="eyebrow" color={Colors.slate}>
          {unit}
        </T>
      ) : null}
      <TextInput value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={Colors.textMuted} keyboardType={keyboard} style={styles.input} />
    </View>
  );
}

const styles = StyleSheet.create({
  head: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.lg,
    gap: 12,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 18,
    borderTopWidth: 1,
    borderTopColor: Colors.line,
  },
  fieldLabel: {
    width: 90,
  },
  input: {
    flex: 1,
    textAlign: 'right',
    fontFamily: FontFamily.medium,
    fontSize: 15,
    color: Colors.ink,
    padding: 0,
  },
  note: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.line,
  },
});
