import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { QueryBoundary } from '@/components/data/QueryBoundary';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { T } from '@/components/ui/Typography';
import { useEstimate, useVehicle } from '@/data/hooks';
import { respondToEstimate } from '@/data/repo';
import { formatDateShort, formatMoney, formatNumber, formatPlate } from '@/lib/format';
import type { Estimate } from '@/types/domain';
import { Colors, Radius, Spacing } from '@/theme/tokens';

export default function EstimateDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const estimateQuery = useEstimate(id);
  const { data: vehicle } = useVehicle(estimateQuery.data?.vehicleId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleApprove = async () => {
    setBusy(true);
    setError(null);
    try {
      await respondToEstimate(id, 'approved');
      router.push(`/estimates/${id}/approved`);
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
      await respondToEstimate(id, 'declined');
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <QueryBoundary query={estimateQuery} isEmpty={() => false}>
      {(estimate: Estimate) => {
        const summary = estimate.notes ?? estimate.lines[0]?.description ?? 'Work';
        return (
          <Screen scroll contentStyle={styles.content}>
            <Pressable onPress={() => router.back()}>
              <T variant="eyebrowStrong" color={Colors.accent}>
                ← BACK
              </T>
            </Pressable>

            <T variant="eyebrow" style={styles.eyebrow}>
              EST {estimate.id.toUpperCase()} · SENT {formatDateShort(estimate.createdAt)}
            </T>
            {estimate.status === 'pending' ? (
              <View style={styles.badge}>
                <T variant="eyebrowStrong" color={Colors.warning}>
                  AWAITING YOUR APPROVAL
                </T>
              </View>
            ) : null}

            <T variant="display" style={styles.title}>
              {summary} estimate
            </T>
            <T variant="body" color={Colors.textMuted}>
              {estimate.workshopName}
              {vehicle ? ` · ${formatPlate(vehicle.plate)} · ${formatNumber(vehicle.odometerKm)} km` : ''}
            </T>

            <Card style={styles.linesCard}>
              {estimate.lines.map((l, i) => (
                <View key={l.id} style={[styles.lineRow, i > 0 && styles.lineRowBorder]}>
                  <T variant="bodyStrong" style={styles.lineDesc}>
                    {l.description}
                  </T>
                  <T variant="bodyStrong">{formatMoney(l.cost, '')}</T>
                </View>
              ))}
            </Card>

            <View style={styles.totalRow}>
              <T variant="eyebrow">ESTIMATED TOTAL</T>
              <T variant="numericLarge">{formatMoney(estimate.total)}</T>
            </View>

            <T variant="body" color={Colors.textMuted} style={styles.explainer}>
              Approving this does not move any money. {estimate.workshopName} will invoice you after the work, and the
              cost joins your vehicle history automatically.
            </T>

            {estimate.status === 'pending' ? (
              <View style={styles.actions}>
                {error ? (
                  <T variant="meta" color={Colors.danger} style={styles.error}>
                    {error}
                  </T>
                ) : null}
                <Button onPress={handleApprove} loading={busy}>
                  Approve
                </Button>
                <Button variant="danger" onPress={handleDecline} disabled={busy}>
                  Decline estimate
                </Button>
              </View>
            ) : (
              <View style={styles.resolvedBlock}>
                <T variant="eyebrowStrong" color={estimate.status === 'approved' ? Colors.positive : Colors.danger}>
                  {estimate.status.toUpperCase()}
                </T>
              </View>
            )}
          </Screen>
        );
      }}
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
  badge: {
    backgroundColor: Colors.warningSoft,
    alignSelf: 'flex-start',
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    marginTop: Spacing.xs,
  },
  title: {
    marginTop: Spacing.xs,
  },
  linesCard: {
    marginTop: Spacing.lg,
    marginBottom: Spacing.md,
    gap: 0,
  },
  lineRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: Spacing.xs,
  },
  lineRowBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  lineDesc: {
    flex: 1,
    marginRight: Spacing.sm,
  },
  totalRow: {
    gap: 2,
    marginBottom: Spacing.lg,
  },
  explainer: {
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
