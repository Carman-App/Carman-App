import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { QueryBoundary } from '@/components/data/QueryBoundary';
import { Button } from '@/components/ui/Button';
import { Dot, KeyValueRow, Notice } from '@/components/ui/Blocks';
import { Screen } from '@/components/ui/Screen';
import { T } from '@/components/ui/Typography';
import { TopBar } from '@/components/ui/TopBar';
import { useCurrency, useEstimate, useVehicle } from '@/data/hooks';
import { respondToEstimate } from '@/data/repo';
import { formatDateShort, formatMoney, formatNumber, formatPlate } from '@/lib/format';
import type { Estimate } from '@/types/domain';
import { Colors, Spacing } from '@/theme/tokens';

export default function EstimateDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const estimateQuery = useEstimate(id);
  const { data: vehicle } = useVehicle(estimateQuery.data?.vehicleId);
  const currency = useCurrency();
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
        const pending = estimate.status === 'pending';
        const ago = Math.max(0, Math.round((Date.now() - new Date(estimate.createdAt).getTime()) / 60000));
        const sent = ago < 60 ? `${ago} minutes ago` : ago < 1440 ? `${Math.round(ago / 60)} hours ago` : formatDateShort(estimate.createdAt.slice(0, 10));
        return (
          <Screen
            padded={false}
            header={
              <TopBar
                title="Approval"
                right={
                  pending ? (
                    <View style={styles.waiting}>
                      <Dot />
                      <T variant="meta">Waiting on you</T>
                    </View>
                  ) : (
                    estimate.status === 'approved' ? 'Authorised' : 'Declined'
                  )
                }
              />
            }
            headerRule
            footer={
              pending ? (
                <>
                  {error ? (
                    <T variant="meta" color={Colors.danger} center>
                      {error}
                    </T>
                  ) : null}
                  <View style={styles.actions}>
                    <Button variant="primary" fullWidth={false} disabled={busy} onPress={handleDecline} style={styles.notNow}>
                      Not now
                    </Button>
                    <Button loading={busy} onPress={handleApprove} style={styles.flex}>
                      Authorise
                    </Button>
                  </View>
                </>
              ) : undefined
            }>
            <View style={styles.head}>
              <T variant="display">
                {estimate.workshopName} wants to add {estimate.lines.length > 1 ? 'work' : 'a repair'}
              </T>
              <T variant="meta">
                {summary} · {formatMoney(estimate.total, currency)} · sent {sent}
              </T>
            </View>
            <KeyValueRow label="Vehicle" value={vehicle ? `${vehicle.model}${vehicle.plate ? ` · ${formatPlate(vehicle.plate)}` : ''}` : '—'} />
            <KeyValueRow label="Work" value={summary} />
            {estimate.lines.map((l) => (
              <KeyValueRow key={l.id} label="" value={l.description} sub={formatMoney(l.cost, currency)} />
            ))}
            <KeyValueRow label="Amount" value={formatMoney(estimate.total, currency)} />
            <KeyValueRow label="From" value={estimate.workshopName} />
            <KeyValueRow label="Sent" value={sent} />
            {vehicle ? <KeyValueRow label="Odometer" value={`${formatNumber(vehicle.odometerKm)} km`} last /> : null}
            <Notice style={styles.notice}>
              {`Authorising adds this ${estimate.lines.length > 1 ? 'work' : 'repair'} to the ${vehicle?.model ?? 'vehicle'} and tells ${estimate.workshopName} to go ahead. Nothing is paid from Carma.`}
            </Notice>
          </Screen>
        );
      }}
    </QueryBoundary>
  );
}

const styles = StyleSheet.create({
  waiting: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  head: {
    padding: Spacing.lg,
    gap: 10,
  },
  notice: {
    marginTop: Spacing.lg,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  notNow: {
    paddingHorizontal: Spacing.lg,
  },
  flex: {
    flex: 1,
  },
});
