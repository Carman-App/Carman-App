import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { QueryBoundary } from '@/components/data/QueryBoundary';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { T } from '@/components/ui/Typography';
import { queryClient } from '@/data/queryClient';
import { useVehicle } from '@/data/hooks';
import { respondToAccessRequest } from '@/data/repo';
import { formatDateWithYear, formatNumber } from '@/lib/format';
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
        <Screen scroll contentStyle={styles.content}>
          <Pressable onPress={() => router.back()}>
            <T variant="eyebrowStrong" color={Colors.accent}>
              ← BACK
            </T>
          </Pressable>

          <T variant="eyebrow" style={styles.eyebrow}>
            {formatDateWithYear(request.requestedAt)}
          </T>
          <T variant="display" style={styles.title}>
            {request.workshopName} scanned your {vehicle?.model ?? 'vehicle'}
          </T>
          <T variant="meta" style={styles.contextLine}>
            CONNECTED WORKSHOP · {request.scope}
          </T>

          <Card style={styles.sectionCard}>
            <T variant="eyebrow" style={styles.cardHeading}>
              THEY WILL SEE
            </T>
            <T variant="body">Make, model, year and VIN</T>
            <T variant="body">Current odometer{vehicle ? ` · ${formatNumber(vehicle.odometerKm)} km` : ''}</T>
            <T variant="body">Service and repair history</T>
          </Card>

          <Card style={styles.sectionCard}>
            <T variant="eyebrow" style={styles.cardHeading}>
              THEY WILL NOT SEE
            </T>
            <T variant="body">Parking, car washes, fines</T>
            <T variant="body">Insurance amounts</T>
            <T variant="body">Invoices from other mechanics</T>
          </Card>

          <T variant="body" color={Colors.textMuted} style={styles.explainer}>
            You can revoke this at any time. Work already completed stays in your vehicle history.
          </T>

          {request.status === 'pending' ? (
            <View style={styles.actions}>
              {error ? (
                <T variant="meta" color={Colors.danger} style={styles.error}>
                  {error}
                </T>
              ) : null}
              <Button onPress={handleAllow} loading={busy}>
                Allow access
              </Button>
              <Button variant="ghost" onPress={handleDecline} disabled={busy}>
                Decline
              </Button>
            </View>
          ) : (
            <View style={styles.resolvedBlock}>
              <T variant="eyebrowStrong" color={request.status === 'approved' ? Colors.positive : Colors.danger}>
                {request.status.toUpperCase()}
              </T>
            </View>
          )}
        </Screen>
      )}
    </QueryBoundary>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xl,
  },
  eyebrow: {
    marginTop: Spacing.md,
  },
  title: {
    marginTop: Spacing.xxs,
  },
  contextLine: {
    marginTop: Spacing.xs,
    marginBottom: Spacing.lg,
  },
  sectionCard: {
    marginBottom: Spacing.md,
    gap: Spacing.xxs,
  },
  cardHeading: {
    marginBottom: Spacing.xxs,
  },
  explainer: {
    marginTop: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  actions: {
    gap: Spacing.sm,
  },
  error: {
    textAlign: 'center',
  },
  resolvedBlock: {
    alignItems: 'center',
    paddingVertical: Spacing.md,
  },
});
