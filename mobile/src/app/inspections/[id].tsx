import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { QueryBoundary } from '@/components/data/QueryBoundary';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { T } from '@/components/ui/Typography';
import { TopBar } from '@/components/ui/TopBar';
import { useInspection, useVehicle } from '@/data/hooks';
import { formatDateWithYear } from '@/lib/format';
import type { InspectionReport } from '@/types/domain';
import { Colors, Radius, Spacing } from '@/theme/tokens';

const STATUS_COLOR: Record<string, { fg: string; bg: string }> = {
  good: { fg: Colors.positive, bg: Colors.positiveSoft },
  attention: { fg: Colors.warning, bg: Colors.warningSoft },
  urgent: { fg: Colors.danger, bg: Colors.dangerSoft },
};

const STATUS_LABEL: Record<string, string> = {
  good: 'GOOD',
  attention: 'MONITOR',
  urgent: 'NEEDS ATTENTION',
};

export default function InspectionReportScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const inspectionQuery = useInspection(id);
  const { data: vehicle } = useVehicle(inspectionQuery.data?.vehicleId);
  const [decisions, setDecisions] = useState<Record<string, 'do' | 'not-now'>>({});

  return (
    <QueryBoundary query={inspectionQuery} isEmpty={() => false}>
      {(inspection: InspectionReport) => {
        const total = inspection.items.length;
        const approved = inspection.items.filter((i) => i.status === 'good').length;
        const counts = {
          urgent: inspection.items.filter((i) => i.status === 'urgent').length,
          attention: inspection.items.filter((i) => i.status === 'attention').length,
          good: inspection.items.filter((i) => i.status === 'good').length,
        };
        const undecidedCount = inspection.items.filter((i) => i.status !== 'good' && !decisions[i.id]).length;

        return (
          <Screen header={<TopBar backLabel="BACK" />} scroll contentStyle={styles.content}>

            <T variant="eyebrow" style={styles.eyebrow}>
              {approved} OF {total} APPROVED
            </T>
            <T variant="display" style={styles.title}>
              {inspection.workshopName} checked your car
            </T>
            <T variant="body" color={Colors.textMuted}>
              {vehicle ? `${vehicle.make} ${vehicle.model} · ` : ''}
              {formatDateWithYear(inspection.createdAt)} · {total} points
            </T>

            <View style={styles.summaryRow}>
              <View style={styles.summaryPill}>
                <T variant="numeric" color={Colors.danger}>
                  {counts.urgent}
                </T>
                <T variant="meta">URGENT</T>
              </View>
              <View style={styles.summaryPill}>
                <T variant="numeric" color={Colors.warning}>
                  {counts.attention}
                </T>
                <T variant="meta">MONITOR</T>
              </View>
              <View style={styles.summaryPill}>
                <T variant="numeric" color={Colors.positive}>
                  {counts.good}
                </T>
                <T variant="meta">GOOD</T>
              </View>
            </View>

            <T variant="body" style={styles.summaryText}>
              {inspection.summary}
            </T>

            {inspection.items.map((item) => {
              const colors = STATUS_COLOR[item.status];
              const decision = decisions[item.id];
              return (
                <Card key={item.id} style={styles.itemCard}>
                  <View style={styles.itemHeader}>
                    <T variant="bodyStrong" style={styles.itemLabel}>
                      {item.label}
                    </T>
                    <View style={[styles.statusBadge, { backgroundColor: colors.bg }]}>
                      <T variant="meta" color={colors.fg} style={{ fontFamily: undefined }}>
                        {STATUS_LABEL[item.status] ?? item.status.toUpperCase()}
                      </T>
                    </View>
                  </View>
                  {item.note ? (
                    <T variant="meta" style={styles.itemNote}>
                      {item.note}
                    </T>
                  ) : null}
                  {item.status !== 'good' ? (
                    <View style={styles.itemActions}>
                      <Pressable accessibilityRole="button"
                        style={[styles.actionChip, decision === 'do' && styles.actionChipSelected]}
                        onPress={() => setDecisions((d) => ({ ...d, [item.id]: 'do' }))}>
                        <T variant="meta" color={decision === 'do' ? Colors.white : Colors.textMuted} style={{ fontFamily: undefined }}>
                          DO IT
                        </T>
                      </Pressable>
                      <Pressable accessibilityRole="button"
                        style={[styles.actionChip, decision === 'not-now' && styles.actionChipSelected]}
                        onPress={() => setDecisions((d) => ({ ...d, [item.id]: 'not-now' }))}>
                        <T
                          variant="meta"
                          color={decision === 'not-now' ? Colors.white : Colors.textMuted}
                          style={{ fontFamily: undefined }}>
                          NOT NOW
                        </T>
                      </Pressable>
                    </View>
                  ) : null}
                </Card>
              );
            })}

            <T variant="body" color={Colors.textMuted} style={styles.explainer}>
              Red items are safety. You can decline any of them, and Carma keeps the record that you were told.
            </T>

            {undecidedCount > 0 ? (
              <View style={styles.decideBar}>
                <T variant="bodyStrong" color={Colors.white}>
                  DECIDE ON {undecidedCount} MORE
                </T>
              </View>
            ) : null}
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
  title: {
    marginTop: Spacing.xxs,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.lg,
    marginBottom: Spacing.md,
  },
  summaryPill: {
    flex: 1,
    backgroundColor: Colors.surfaceMuted,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
    gap: 2,
  },
  summaryText: {
    marginBottom: Spacing.lg,
  },
  itemCard: {
    marginBottom: Spacing.sm,
    gap: Spacing.xs,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  itemLabel: {
    flex: 1,
  },
  statusBadge: {
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
  },
  itemNote: {},
  itemActions: {
    flexDirection: 'row',
    gap: Spacing.xs,
    marginTop: Spacing.xxs,
  },
  actionChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.xs,
    borderRadius: Radius.pill,
    backgroundColor: Colors.surfaceMuted,
  },
  actionChipSelected: {
    backgroundColor: Colors.accent,
  },
  explainer: {
    marginTop: Spacing.md,
    marginBottom: Spacing.lg,
  },
  decideBar: {
    backgroundColor: Colors.accent,
    borderRadius: Radius.md,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
});
