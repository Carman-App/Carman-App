import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, Share, StyleSheet, View } from 'react-native';

import { QueryBoundary } from '@/components/data/QueryBoundary';
import { QrCode } from '@/components/ui/QrCode';
import { Screen } from '@/components/ui/Screen';
import { T } from '@/components/ui/Typography';
import { TopBar } from '@/components/ui/TopBar';
import { useAccessRequests, useVehicle } from '@/data/hooks';
import { formatPlate } from '@/lib/format';
import { Colors, Spacing } from '@/theme/tokens';

/** Share access: a mechanic scans this code; the owner approves; nothing is shared until they do. */
export default function VehicleQrScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const vehicleQuery = useVehicle(id);
  const requests = useAccessRequests(id).data ?? [];
  const pending = requests.filter((r) => r.status === 'pending');
  const granted = requests.filter((r) => r.status === 'approved');

  return (
    <Screen padded={false} header={<TopBar backLabel="VEHICLE" right="VEHICLE QR" />}>
      <QueryBoundary query={vehicleQuery} isEmpty={() => false}>
        {(v) => {
          const code = `carma://vehicle/${v.id}`;
          const label = `CARMA · ${formatPlate(v.plate)} · V-${v.id.slice(-4).toUpperCase()}`;
          return (
            <>
              <View style={styles.pad}>
                <T variant="display" style={styles.title}>
                  Let a mechanic see this vehicle
                </T>
                <T variant="lede">They scan this code. You approve. Nothing is shared until you do.</T>
              </View>
              <View style={styles.sand}>
                <View style={styles.qr}>
                  <QrCode value={code} size={176} />
                </View>
                <T variant="eyebrow" color={Colors.slate}>
                  {label}
                </T>
              </View>
              <View style={styles.sectionHead}>
                <T variant="eyebrow" color={Colors.slate}>
                  WHO HAS ACCESS
                </T>
                {pending.length ? (
                  <T variant="eyebrow" color={Colors.signal}>
                    {pending.length} REQUEST{pending.length === 1 ? '' : 'S'}
                  </T>
                ) : null}
              </View>
              {pending.map((r) => (
                <Pressable accessibilityRole="button" key={r.id} onPress={() => router.push(`/access-requests/${r.id}`)} style={[styles.access, styles.accessPending]}>
                  <View style={styles.flex}>
                    <T variant="bodyStrong">{r.workshopName}</T>
                    <T variant="eyebrow" color={Colors.signal}>
                      SCANNED YOUR {v.model.toUpperCase()} · WAITING ON YOU
                    </T>
                  </View>
                  <T variant="eyebrowStrong">REVIEW REQUEST</T>
                </Pressable>
              ))}
              {granted.map((r) => (
                <View key={r.id} style={styles.access}>
                  <View style={styles.flex}>
                    <T variant="bodyStrong">{r.workshopName}</T>
                    <T variant="eyebrow" color={Colors.positive}>
                      CONNECTED
                    </T>
                  </View>
                </View>
              ))}
              {requests.length === 0 ? (
                <T variant="meta" style={styles.pad}>
                  No one has access yet.
                </T>
              ) : null}
              <View style={styles.explain}>
                <T variant="meta" color={Colors.slate}>
                  A connected mechanic sees the vehicle, its odometer and its service history. They never see your parking, car washes, insurance amounts or other mechanics’ invoices.
                </T>
              </View>
              <View style={styles.actions}>
                <Pressable accessibilityRole="button" style={styles.action} onPress={() => Share.share({ message: `Scan or open to request access to my ${v.make} ${v.model} on Carma: ${code}` })}>
                  <T variant="eyebrowStrong" color={Colors.accent}>
                    SHARE CODE
                  </T>
                </Pressable>
                <View style={styles.divider} />
                <Pressable accessibilityRole="button" style={styles.action} onPress={() => Share.share({ message: label })}>
                  <T variant="eyebrowStrong" color={Colors.accent}>
                    PRINT FOR GLOVEBOX
                  </T>
                </Pressable>
              </View>
            </>
          );
        }}
      </QueryBoundary>
    </Screen>
  );
}

const styles = StyleSheet.create({
  pad: {
    paddingHorizontal: Spacing.lg,
  },
  title: {
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  sand: {
    marginTop: Spacing.lg,
    backgroundColor: Colors.surfaceSand,
    alignItems: 'center',
    paddingVertical: Spacing.xl,
    gap: Spacing.md,
  },
  qr: {
    backgroundColor: Colors.white,
    padding: 10,
    borderRadius: 8,
  },
  sectionHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  access: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    paddingLeft: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  accessPending: {
    borderLeftWidth: 2,
    borderLeftColor: Colors.signal,
  },
  flex: {
    flex: 1,
    gap: 6,
  },
  explain: {
    backgroundColor: Colors.surfaceWarm,
    padding: Spacing.lg,
    marginTop: Spacing.sm,
  },
  actions: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  action: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.lg,
  },
  divider: {
    width: 1,
    backgroundColor: Colors.border,
  },
});
