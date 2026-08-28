import { router, useLocalSearchParams } from 'expo-router';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { IconGlyph } from '@/components/ui/IconGlyph';
import { Screen } from '@/components/ui/Screen';
import { T } from '@/components/ui/Typography';
import { QueryBoundary } from '@/components/data/QueryBoundary';
import { useAccessRequests, useVehicle } from '@/data/hooks';
import { formatPlate } from '@/lib/format';
import { Colors, Radius, Spacing } from '@/theme/tokens';

export default function VehicleQrScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const vehicleQuery = useVehicle(id);
  const requests = useAccessRequests(id).data ?? [];
  const pending = requests.find((r) => r.status === 'pending');

  return (
    <Screen scroll contentStyle={styles.content}>
      <Pressable onPress={() => router.back()}>
        <T variant="eyebrowStrong" color={Colors.accent}>
          ← BACK
        </T>
      </Pressable>

      <QueryBoundary query={vehicleQuery} isEmpty={() => false}>
        {(vehicle) => {
          const code = `CARMA · ${formatPlate(vehicle.plate)} · V-${vehicle.id.slice(-4).toUpperCase()}`;
          return (
            <>
              <T variant="display" style={styles.title}>
                Let a mechanic see this vehicle
              </T>
              <T variant="body" color={Colors.textMuted} style={styles.body}>
                They scan this code. You approve. Nothing is shared until you do.
              </T>

              <View style={styles.qrBox}>
                <IconGlyph glyph="qr" size={96} bg="transparent" />
                <T variant="meta" center style={styles.qrCode}>
                  {code}
                </T>
              </View>

              <T variant="eyebrow" style={styles.sectionTitle}>
                WHO HAS ACCESS
              </T>
              {pending ? (
                <Card style={styles.accessCard}>
                  <T variant="bodyStrong">{pending.workshopName}</T>
                  <T variant="meta" color={Colors.warning} style={styles.awaiting}>
                    AWAITING YOUR APPROVAL
                  </T>
                  <Button size="md" style={styles.reviewBtn} onPress={() => router.push(`/access-requests/${pending.id}`)}>
                    Review request
                  </Button>
                </Card>
              ) : requests.length === 0 ? (
                <Card style={styles.accessCard}>
                  <T variant="meta">NO ONE HAS ACCESS</T>
                </Card>
              ) : (
                <Card style={styles.accessCard}>
                  {requests.map((r) => (
                    <T variant="body" key={r.id}>
                      {r.workshopName} · {r.status.toUpperCase()}
                    </T>
                  ))}
                </Card>
              )}

              <T variant="body" color={Colors.textMuted} style={styles.explainerCard}>
                A connected mechanic sees the vehicle, its odometer and its service history. They never see your parking, car
                washes, insurance amounts or other mechanics&apos; invoices.
              </T>

              <View style={styles.actions}>
                <Button variant="secondary" onPress={() => Alert.alert('Share code', 'A share sheet would open here.')}>
                  Share code
                </Button>
                <Button variant="ghost" onPress={() => Alert.alert('Print', 'A print-friendly card would open here.')}>
                  Print for glovebox
                </Button>
              </View>
            </>
          );
        }}
      </QueryBoundary>
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
    marginBottom: Spacing.lg,
  },
  qrBox: {
    alignSelf: 'center',
    width: 220,
    height: 220,
    borderWidth: 2,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  qrCode: {
    fontFamily: 'monospace',
    maxWidth: 180,
  },
  sectionTitle: {
    marginBottom: Spacing.xs,
  },
  accessCard: {
    marginBottom: Spacing.lg,
    gap: 2,
  },
  awaiting: {
    marginTop: 2,
  },
  reviewBtn: {
    marginTop: Spacing.sm,
  },
  explainerCard: {
    marginBottom: Spacing.xl,
  },
  actions: {
    gap: Spacing.xs,
  },
});
