import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Dot } from '@/components/ui/Blocks';
import { Chip } from '@/components/ui/Chip';
import { EmptyState } from '@/components/ui/EmptyState';
import { IconGlyph } from '@/components/ui/IconGlyph';
import { Screen } from '@/components/ui/Screen';
import { T } from '@/components/ui/Typography';
import { TopBar } from '@/components/ui/TopBar';
import {
  markNotificationRead,
  useActiveGarage,
  useCurrency,
  useGarageReminders,
  useNotifications,
  usePendingAccessRequests,
  usePendingEstimates,
  useVehicles,
} from '@/data/hooks';
import { ReminderRow } from '@/features/activity/ReminderRow';
import { formatDateShort, formatNumber } from '@/lib/format';
import { Colors, Spacing } from '@/theme/tokens';

type Item = {
  id: string;
  title: string;
  body: string;
  when: string;
  unread: boolean;
  glyph: string;
  hue: string;
  tint: string;
  onPress?: () => void;
};

function ago(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  const h = Math.floor(ms / 3_600_000);
  if (h < 1) return 'Now';
  if (h < 24) return `${h}h`;
  if (h < 48) return 'Yesterday';
  return formatDateShort(iso.slice(0, 10));
}

/**
 * Reminders and notifications. One page, two filters. Notifications are
 * things that already happened; reminders are things still due.
 */
export default function ActivityScreen() {
  const garage = useActiveGarage().data;
  const vehicles = useVehicles(garage?.id).data ?? [];
  const notifications = useNotifications().data ?? [];
  const estimates = usePendingEstimates(vehicles.map((v) => v.id)).data;
  const access = usePendingAccessRequests(garage?.id).data ?? [];
  const reminders = (useGarageReminders(garage?.id).data ?? []).filter((r) => !r.resolved);
  const currency = useCurrency();
  const [tab, setTab] = useState<'notifications' | 'reminders'>('notifications');

  const items: Item[] = [
    ...estimates.map((e) => ({
      id: `est-${e.id}`,
      title: `${e.workshopName} sent an estimate`,
      body: `${vehicles.find((v) => v.id === e.vehicleId)?.model ?? 'Vehicle'} · ${currency} ${formatNumber(e.total)} waiting on you`,
      when: ago(e.createdAt),
      unread: true,
      glyph: 'estimate',
      hue: Colors.signal,
      tint: Colors.signalSoft,
      onPress: () => router.push(`/estimates/${e.id}`),
    })),
    ...access.map((a) => ({
      id: `acc-${a.id}`,
      title: `${a.workshopName} asked to see a vehicle`,
      body: a.scope,
      when: ago(a.requestedAt),
      unread: true,
      glyph: 'qr',
      hue: Colors.orange,
      tint: Colors.warningSoft,
      onPress: () => router.push(`/access-requests/${a.id}`),
    })),
    ...notifications.map((n) => ({
      id: n.id,
      title: n.title,
      body: n.body,
      when: ago(n.createdAt),
      unread: !n.readAt,
      glyph: 'reminder',
      hue: Colors.accent,
      tint: Colors.accentSoft,
      onPress: () => {
        if (!n.readAt) void markNotificationRead(n.id);
      },
    })),
  ];
  const fresh = items.filter((i) => i.unread).length;

  return (
    <Screen padded={false} header={<TopBar title="Activity" right={`${fresh} new`} />}>
      <View style={styles.tabs}>
        <Chip label="Notifications" value={String(fresh || '')} selected={tab === 'notifications'} onPress={() => setTab('notifications')} />
        <Chip label="Reminders" value={String(reminders.length || '')} selected={tab === 'reminders'} onPress={() => setTab('reminders')} />
      </View>
      {tab === 'notifications' ? (
        items.length === 0 ? (
          <EmptyState glyph="reminder" title="Nothing new." body="Estimates, access requests and changes other members make show up here." />
        ) : (
          <>
            {items.map((i) => (
              <Pressable key={i.id} onPress={i.onPress} style={({ pressed }) => [styles.row, pressed && { backgroundColor: '#F7F5F2' }]}>
                <IconGlyph glyph={i.glyph} size={32} shape="tile" bg={i.tint} fg={i.hue} />
                <View style={styles.flex}>
                  <View style={styles.between}>
                    <T variant="bodyStrong" style={styles.flex}>
                      {i.title}
                    </T>
                    <T variant="small">{i.when}</T>
                  </View>
                  <T variant="meta">{i.body}</T>
                </View>
                <View style={styles.dot}>{i.unread ? <Dot color={Colors.accent} /> : null}</View>
              </Pressable>
            ))}
            <T variant="meta" style={styles.note}>
              Things that happened. Anything still due sits under Reminders.
            </T>
          </>
        )
      ) : reminders.length === 0 ? (
        <EmptyState glyph="reminder" title="Nothing due." body="Service intervals and document expiry dates become reminders as you record them." />
      ) : (
        reminders.map((r) => <ReminderRow key={r.id} reminder={r} vehicle={vehicles.find((v) => v.id === r.vehicleId)} />)
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  tabs: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
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
    marginBottom: 4,
  },
  dot: {
    width: 8,
    paddingTop: 22,
  },
  note: {
    padding: Spacing.lg,
  },
});
