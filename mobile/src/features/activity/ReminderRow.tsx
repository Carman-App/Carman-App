import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { IconGlyph } from '@/components/ui/IconGlyph';
import { T } from '@/components/ui/Typography';
import { resolveReminder } from '@/data/repo';
import { daysUntil, formatNumber, formatPlate } from '@/lib/format';
import { Colors, Spacing } from '@/theme/tokens';
import type { Reminder, Vehicle } from '@/types/domain';

const KIND_STYLE: Record<Reminder['kind'], { glyph: string; hue: string; tint: string; source: string }> = {
  'service-due': { glyph: 'service', hue: Colors.accent, tint: Colors.accentSoft, source: 'From the service interval on this vehicle.' },
  'document-expiry': { glyph: 'insurance', hue: Colors.signal, tint: Colors.signalSoft, source: 'From the expiry date on the document.' },
  'estimate-pending': { glyph: 'estimate', hue: Colors.orange, tint: Colors.warningSoft, source: 'A mechanic is waiting on your answer.' },
  'project-stalled': { glyph: 'build', hue: Colors.positive, tint: Colors.positiveSoft, source: 'No entry on this project for 14 days.' },
  'payment-due': { glyph: 'loan', hue: Colors.orange, tint: Colors.warningSoft, source: 'You asked to be reminded when you saved the record.' },
  'warranty-end': { glyph: 'repair', hue: Colors.accent, tint: Colors.accentSoft, source: 'From the warranty on the repair you saved.' },
};

/** How far away a reminder is, in the unit it is measured in. */
export function reminderDue(r: Reminder, vehicle?: Vehicle): { text: string; urgent: boolean; warn: boolean } {
  if (r.dueKm && vehicle) {
    const left = r.dueKm - vehicle.odometerKm;
    return { text: left < 0 ? `${formatNumber(-left)} km over` : `${formatNumber(left)} km`, urgent: left < 0, warn: left < 1000 };
  }
  if (r.dueDate) {
    const d = daysUntil(r.dueDate);
    if (d < 0) return { text: `${-d} days late`, urgent: true, warn: true };
    if (d <= 60) return { text: `${d} days`, urgent: d <= 21, warn: true };
    return { text: `${Math.round(d / 30)} months`, urgent: false, warn: false };
  }
  return { text: '', urgent: false, warn: false };
}

/** One reminder: tile, what is due, the car, and where the reminder came from. */
export function ReminderRow({ reminder, vehicle }: { reminder: Reminder; vehicle?: Vehicle }) {
  const s = KIND_STYLE[reminder.kind];
  const due = reminderDue(reminder, vehicle);
  const [busy, setBusy] = useState(false);
  return (
    <Pressable onPress={() => vehicle && router.push(`/vehicle/${vehicle.id}`)} style={({ pressed }) => [styles.row, pressed && { backgroundColor: '#F7F5F2' }]}>
      <IconGlyph glyph={s.glyph} size={32} shape="tile" bg={s.tint} fg={s.hue} />
      <View style={styles.flex}>
        <View style={styles.between}>
          <T variant="bodyStrong" style={styles.flex}>
            {reminder.description}
          </T>
          <T variant="small" color={due.urgent ? Colors.signal : due.warn ? Colors.orange : Colors.body}>
            {due.text}
          </T>
        </View>
        {vehicle ? (
          <T variant="meta">
            {vehicle.model} · {formatPlate(vehicle.plate)}
          </T>
        ) : null}
        <T variant="body" style={styles.source}>
          {s.source}
        </T>
        <Pressable
          hitSlop={8}
          disabled={busy}
          onPress={async () => {
            setBusy(true);
            try {
              await resolveReminder(reminder.id);
            } finally {
              setBusy(false);
            }
          }}>
          <T variant="section" color={busy ? Colors.textFaint : Colors.accent}>
            {busy ? 'Marking done…' : 'Mark done'}
          </T>
        </Pressable>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 14,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderSoft,
  },
  flex: {
    flex: 1,
  },
  between: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
  },
  source: {
    marginTop: 6,
    marginBottom: 8,
  },
});
