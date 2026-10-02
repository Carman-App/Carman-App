import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { ProgressSteps } from '@/components/ui/ProgressSteps';
import { Screen } from '@/components/ui/Screen';
import { TextField } from '@/components/ui/TextField';
import { T } from '@/components/ui/Typography';
import { useVehicle } from '@/data/hooks';
import { getActiveCurrency } from '@/lib/format';
import { Colors, Spacing } from '@/theme/tokens';

export default function SellWhoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const vehicle = useVehicle(id).data;
  const [buyer, setBuyer] = useState('');
  const [phone, setPhone] = useState('');
  const [salePrice, setSalePrice] = useState('');

  if (!vehicle) return null;

  const canContinue = buyer.trim().length > 0;

  const handleContinue = () => {
    router.push({
      pathname: `/vehicle/${id}/sell-what`,
      params: { buyer: buyer.trim(), phone: phone.trim(), salePrice: salePrice.trim() },
    });
  };

  return (
    <Screen
      contentStyle={styles.content}
      footer={
        <Button disabled={!canContinue} onPress={handleContinue}>
          Who is buying it?
        </Button>
      }>
      <ProgressSteps step={1} total={3} />
      <T variant="display" style={styles.title}>
        Who is buying the {vehicle.model}?
      </T>
      <T variant="body" color={Colors.textMuted} style={styles.body}>
        They get a text with the handover code. If they are not on Carma, it walks them through setting up first.
      </T>

      <TextField label="BUYER" value={buyer} onChangeText={setBuyer} placeholder="Full name" autoFocus />
      <View style={styles.field}>
        <TextField label="PHONE" value={phone} onChangeText={setPhone} placeholder="+254..." keyboardType="phone-pad" />
      </View>
      <View style={styles.field}>
        <TextField
          label="SALE PRICE"
          value={salePrice}
          onChangeText={(v) => setSalePrice(v.replace(/[^0-9]/g, ''))}
          placeholder="0"
          keyboardType="number-pad"
          prefix={getActiveCurrency()}
          helper="OPTIONAL. FOR YOUR OWN RECORD ONLY."
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: Spacing.sm,
  },
  title: {
    marginTop: Spacing.md,
  },
  body: {
    marginTop: Spacing.xs,
    marginBottom: Spacing.xl,
  },
  field: {
    marginTop: Spacing.lg,
  },
});
