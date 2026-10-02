import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { QueryBoundary } from '@/components/data/QueryBoundary';
import { Button } from '@/components/ui/Button';
import { Rule } from '@/components/ui/Blocks';
import { Screen } from '@/components/ui/Screen';
import { T } from '@/components/ui/Typography';
import { TopBar } from '@/components/ui/TopBar';
import { queryClient } from '@/data/queryClient';
import { useVehicle } from '@/data/hooks';
import { respondToAccessRequest } from '@/data/repo';
import { formatDateShort, formatDateWithYear, formatNumber } from '@/lib/format';
import type { AccessRequest } from '@/types/domain';
import { Colors, Spacing } from '@/theme/tokens';

/**
 * No singular `GET /access-requests/:id` endpoint exists — only the
 * vehicle-scoped `useAccessRequests(vehicleId)` list and the garage-scoped
 * `usePendingAccessRequests(garageId)` in `@/data/hooks`. This reads whatever
 * one of those list queries has already cached, the same "look it up in a
 * list I already fetched" approach `useRecord`/`useDocument` use in that
 * file — replacing the old direct `@/data/store` lookup. A cold deep link
 * with nothing cached yet resolves to `undefined`, same as before.
 */
function useAccessRequest(id: string | undefined) {
  return useQuery({
    queryKey: ['accessRequest', id] as const,
    queryFn: () => {
      for (const prefix of ['accessRequests', 'pendingAccessRequests']) {
        const entries = queryClient.getQueriesData<AccessRequest[]>({ queryKey: [prefix] });
        for (const [, data] of entries) {
          const found = data?.find((r) => r.id === id);
          if (found) return found;
        }
      }
      // React Query forbids a queryFn ever resolving `undefined` (it throws
      // "Query data cannot be undefined") — `null` is the correct "not
      // found in cache yet" value.
      return null;
    },
    enabled: !!id,
  });
}

export default function AccessRequestScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const requestQuery = useAccessRequest(id);
  const { data: vehicle } = useVehicle(requestQuery.data?.vehicleId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAllow = async () => {
    setBusy(true);
    setError(null);
    try {
      await respondToAccessRequest(id, 'approved');
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const handleDecline = async () => {
    setBusy(true);
    setError(null);
    try {
      await respondToAccessRequest(id, 'denied');
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <QueryBoundary query={requestQuery} isEmpty={() => false}>
      {(request: AccessRequest) => (
        <Screen
          header={<TopBar backLabel="VEHICLE QR" right={formatDateShort(request.requestedAt.slice(0, 10))} />}
          footer={
            <>
              {error ? (
                <T variant="meta" color={Colors.danger} center>
                  {error}
                </T>
              ) : null}
              <Button loading={busy} onPress={handleAllow}>
                Allow access
              </Button>
              <Button variant="danger" size="md" caps disabled={busy} onPress={handleDecline}>
                Decline
              </Button>
            </>
          }>
          <View style={styles.head}>
            <View style={styles.badge}>
              <T variant="eyebrowStrong" color={Colors.white}>
                ACCESS REQUEST
              </T>
            </View>
            <T variant="display">
              {request.workshopName} scanned your {vehicle?.model ?? 'vehicle'}
            </T>
            <T variant="eyebrow" color={Colors.slate}>
              {[vehicle ? formatNumber(vehicle.odometerKm) + ' KM' : null, `REQUESTED ${formatDateWithYear(request.requestedAt.slice(0, 10))}`].filter(Boolean).join(' · ')}
            </T>
          </View>
          <Rule />
          <T variant="eyebrow" color={Colors.slate} style={styles.section}>
            THEY WILL SEE
          </T>
          {['Make, model, year and VIN', 'Current odometer', 'Service and repair history'].map((t) => (
            <View key={t} style={styles.item}>
              <View style={styles.square} />
              <T variant="body" color={Colors.ink}>
                {t}
              </T>
            </View>
          ))}
          <T variant="eyebrow" color={Colors.slate} style={styles.section}>
            THEY WILL NOT SEE
          </T>
          {['Parking, car washes, fines', 'Insurance amounts', 'Invoices from other mechanics'].map((t) => (
            <View key={t} style={styles.item}>
              <T variant="body" color={Colors.textFaint}>
                —
              </T>
              <T variant="body" color={Colors.ink}>
                {t}
              </T>
            </View>
          ))}
          <T variant="lede" style={styles.note}>
            You can revoke this at any time. Work already completed stays in your vehicle history.
          </T>
        </Screen>
      )}
    </QueryBoundary>
  );
}

const styles = StyleSheet.create({
  head: {
    paddingTop: Spacing.md,
    paddingBottom: Spacing.lg,
    gap: 10,
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.accent,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  section: {
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xs,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderSoft,
  },
  square: {
    width: 6,
    height: 6,
    backgroundColor: Colors.accent,
  },
  note: {
    paddingTop: Spacing.lg,
  },
});
