import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { IconGlyph } from '@/components/ui/IconGlyph';
import { Screen } from '@/components/ui/Screen';
import { T } from '@/components/ui/Typography';
import { useVehicle } from '@/data/hooks';
import { Colors, Spacing } from '@/theme/tokens';

export default function SellDoneScreen() {
  const { id, buyer, model: modelParam } = useLocalSearchParams<{ id: string; buyer?: string; model?: string }>();
  const vehicle = useVehicle(id).data;
  // The vehicle may already be gone from state (handover without keeping a
  // read-only copy hard-deletes it server-side — see transferVehicle in
  // @/data/repo — so this query 404s) -- fall back to the model name carried
  // in params.
  const model = vehicle?.model ?? modelParam ?? 'vehicle';

  const code = `CARMA-${model.slice(0, 3).toUpperCase()}-0000`;

  return (
    <Screen
      scroll
      contentStyle={styles.content}
      footer={<Button onPress={() => router.replace('/garage')}>Back to my garage</Button>}>
      <View style={styles.iconWrap}>
        <IconGlyph glyph="check" size={64} bg={Colors.accentSoft} fg={Colors.accent} />
      </View>

      <T variant="eyebrowStrong" color={Colors.accent} center>
        HANDED OVER
      </T>
      <T variant="display" center style={styles.title}>
        The {model} and its history are with the buyer.
      </T>

      <Card style={styles.codeCard}>
        <T variant="eyebrow">HANDOVER CODE</T>
        <T variant="numericLarge" style={styles.code}>
          {code}
        </T>
        <T variant="meta">
          SENT TO {buyer ? buyer.toUpperCase() : 'THE BUYER'} · EXPIRES IN 7 DAYS
        </T>
      </Card>

      <T variant="body" color={Colors.textMuted} center style={styles.note}>
        You keep a read-only copy of this vehicle&apos;s history in your garage.
      </T>

      <T variant="meta" center style={styles.footnote}>
        NOTHING MOVES UNTIL THEY ACCEPT. IF THE SALE FALLS THROUGH, CANCEL THE CODE FROM VEHICLE DETAILS.
      </T>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: Spacing.xxl,
  },
  iconWrap: {
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  title: {
    marginTop: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  codeCard: {
    gap: 4,
    marginBottom: Spacing.xl,
  },
  code: {
    marginVertical: 2,
  },
  note: {
    marginBottom: Spacing.xxl,
  },
  footnote: {
    marginBottom: Spacing.lg,
  },
});
