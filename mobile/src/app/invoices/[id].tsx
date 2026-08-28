import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { QueryBoundary } from '@/components/data/QueryBoundary';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { T } from '@/components/ui/Typography';
import { useInvoice, useVehicle } from '@/data/hooks';
import { payInvoice } from '@/data/repo';
import { formatDateShort, formatDateWithYear, formatMoney } from '@/lib/format';
import type { Invoice } from '@/types/domain';
import { Colors, Radius, Spacing } from '@/theme/tokens';

export default function InvoiceDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const invoiceQuery = useInvoice(id);
  const { data: vehicle } = useVehicle(invoiceQuery.data?.vehicleId);
  const [busy, setBusy] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);

  // There's genuinely no payment-creation endpoint in the real API yet
  // (see repo.ts's `payInvoice` doc) — it always throws. Surface that as a
  // real, visible failure instead of a false "paid" success or a crash.
  const handlePay = async () => {
    setBusy(true);
    setPayError(null);
    try {
      await payInvoice(id);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Paying invoices from the app isn’t available yet.';
      setPayError(message);
      Alert.alert('Payment unavailable', message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <QueryBoundary query={invoiceQuery} isEmpty={() => false}>
      {(invoice: Invoice) => {
        const outstanding = invoice.status === 'paid' ? 0 : invoice.total;
        const paidAmount = invoice.status === 'paid' ? invoice.total : 0;
        return (
          <Screen scroll contentStyle={styles.content}>
            <Pressable onPress={() => router.back()}>
              <T variant="eyebrowStrong" color={Colors.accent}>
                ← BACK
              </T>
            </Pressable>

            <T variant="eyebrow" style={styles.eyebrow}>
              INV {invoice.id.toUpperCase()} · {formatDateShort(invoice.createdAt)}
            </T>
            <View style={[styles.statusBadge, invoice.status === 'paid' ? styles.statusPaid : styles.statusUnpaid]}>
              <T variant="eyebrowStrong" color={invoice.status === 'paid' ? Colors.positive : Colors.danger}>
                {invoice.status === 'paid' ? 'PAID' : 'UNPAID'}
              </T>
            </View>

            <T variant="display" style={styles.title}>
              {invoice.workshopName}
            </T>
            <T variant="body" color={Colors.textMuted}>
              {invoice.lines.length} line item{invoice.lines.length === 1 ? '' : 's'}
              {vehicle ? ` · ${vehicle.make} ${vehicle.model}` : ''}
            </T>

            <View style={styles.statGrid}>
              <View style={styles.statCard}>
                <T variant="eyebrow">INCURRED</T>
                <T variant="numeric">{formatMoney(invoice.total, '')}</T>
              </View>
              <View style={styles.statCard}>
                <T variant="eyebrow">PAID</T>
                <T variant="numeric">{formatMoney(paidAmount, '')}</T>
              </View>
              <View style={styles.statCard}>
                <T variant="eyebrow">OUTSTANDING</T>
                <T variant="numeric" color={outstanding > 0 ? Colors.danger : Colors.text}>
                  {formatMoney(outstanding, '')}
                </T>
              </View>
            </View>

            {invoice.dueDate ? (
              <T variant="meta" style={styles.dueDate}>
                DUE {formatDateWithYear(invoice.dueDate)}
              </T>
            ) : null}

            <Card style={styles.linesCard}>
              {invoice.lines.map((l, i) => (
                <View key={l.id} style={[styles.lineRow, i > 0 && styles.lineRowBorder]}>
                  <T variant="bodyStrong" style={styles.lineDesc}>
                    {l.description}
                  </T>
                  <T variant="bodyStrong">{formatMoney(l.cost, '')}</T>
                </View>
              ))}
            </Card>

            <T variant="body" color={Colors.textMuted} style={styles.explainer}>
              Carma does not move money. Your mechanic records what you have paid. The full {formatMoney(invoice.total)}{' '}
              already counts towards this vehicle&apos;s cost.
            </T>

            {payError ? (
              <T variant="meta" color={Colors.danger} style={styles.payError}>
                {payError}
              </T>
            ) : null}

            <View style={styles.actions}>
              <Button variant="secondary">Query invoice</Button>
              {invoice.status === 'unpaid' ? (
                <Button onPress={handlePay} loading={busy}>
                  Mark as paid
                </Button>
              ) : null}
              <Button variant="ghost">Download PDF</Button>
            </View>
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
  statusBadge: {
    alignSelf: 'flex-start',
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    marginTop: Spacing.xs,
  },
  statusPaid: {
    backgroundColor: Colors.positiveSoft,
  },
  statusUnpaid: {
    backgroundColor: Colors.dangerSoft,
  },
  title: {
    marginTop: Spacing.xs,
  },
  statGrid: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.lg,
  },
  statCard: {
    flex: 1,
    gap: 2,
  },
  dueDate: {
    marginTop: Spacing.sm,
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
  explainer: {
    marginBottom: Spacing.md,
  },
  payError: {
    marginBottom: Spacing.md,
  },
  actions: {
    gap: Spacing.sm,
  },
});
