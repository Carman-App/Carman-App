import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '@/components/ui/Avatar';
import { Dot } from '@/components/ui/Blocks';
import { Button, IconButton } from '@/components/ui/Button';
import { ToggleTrack } from '@/components/ui/Chip';
import { IconGlyph } from '@/components/ui/IconGlyph';
import { OptionSheet } from '@/components/ui/OptionSheet';
import { T } from '@/components/ui/Typography';
import {
  useAccount,
  useActiveGarage,
  useGarageMembers,
  useGarages,
  useNotifications,
  usePendingAccessRequests,
  usePendingEstimates,
  useUiState,
  useVehicles,
} from '@/data/hooks';
import { setActiveGarage } from '@/data/repo';
import { pushRecent, setUiState } from '@/data/uiState';
import { ownerSuggestions } from '@/features/assistant/engine';
import { Composer } from '@/features/home/Composer';
import { Drawer, type DrawerItem } from '@/features/home/Drawer';
import { CATEGORY_TINT, RECORD_CATEGORIES, categoryHref } from '@/features/record/categories';
import { formatMoney } from '@/lib/format';
import { Colors, FontFamily, Radius, Spacing } from '@/theme/tokens';

/**
 * Owner Home. One question and one place to answer it: the scope switch
 * (garage | vehicle) at the top, an approval line when a mechanic is
 * waiting, suggested questions, and the composer.
 */
export default function HomeScreen() {
  const account = useAccount().data;
  const garage = useActiveGarage().data;
  const garages = useGarages().data ?? [];

  const vehicles = useVehicles(garage?.id).data ?? [];
  const members = useGarageMembers(garage?.id).data ?? [];
  const homeVehicleId = useUiState('homeVehicleId');
  const recents = useUiState('recents');
  const vehicle = vehicles.find((v) => v.id === homeVehicleId);
  const estimates = usePendingEstimates(vehicles.map((v) => v.id)).data;
  const accessRequests = usePendingAccessRequests(garage?.id).data ?? [];
  const unread = (useNotifications().data ?? []).filter((n) => !n.readAt).length;

  const [text, setText] = useState('');
  const [drawer, setDrawer] = useState(false);
  const [picker, setPicker] = useState<'garage' | 'vehicle' | null>(null);
  const [adding, setAdding] = useState(false);

  const approval = estimates[0];
  const approvalVehicle = approval ? vehicles.find((v) => v.id === approval.vehicleId) : undefined;
  const hasAlerts = unread > 0 || accessRequests.length > 0 || estimates.length > 0;

  const ask = (q: string) => {
    const question = q.trim();
    if (!question) return;
    void pushRecent(question);
    setText('');
    router.push({ pathname: '/assistant', params: { q: question } });
  };

  const drawerItems: DrawerItem[] = useMemo(
    () => [
      { label: 'Garage', meta: `${vehicles.length} vehicle${vehicles.length === 1 ? '' : 's'}`, glyph: 'home', hue: Colors.positive, tint: Colors.positiveSoft, href: '/garage' },
      { label: 'Documents', glyph: 'document', hue: Colors.violet, tint: Colors.violetSoft, href: '/documents' },
      { label: 'Reminders and notifications', glyph: 'reminder', hue: Colors.orange, tint: Colors.warningSoft, href: '/notifications', dot: hasAlerts },
      { label: 'Garage members', meta: String(members.length || ''), glyph: 'members', hue: Colors.teal, tint: Colors.tealSoft, href: garage ? `/garages/${garage.id}/members` : '/garages' },
    ],
    [vehicles.length, members.length, hasAlerts, garage]
  );

  const scope = vehicle ? 'vehicle' : 'garage';

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <Pressable onPress={() => setDrawer(true)} accessibilityLabel="Open menu">
            <Avatar name={account?.name ?? ''} size={44} />
            {hasAlerts ? (
              <View style={styles.alertDot}>
                <Dot size={9} />
              </View>
            ) : null}
          </Pressable>
          <View style={styles.scope}>
            <ToggleTrack
              value={scope}
              onChange={(k) => {
                if (k === 'garage') {
                  if (scope === 'garage') setPicker('garage');
                  else void setUiState({ homeVehicleId: null });
                } else setPicker('vehicle');
              }}
              options={[
                { key: 'garage', label: garage?.name ?? 'Garage', glyph: 'home' },
                { key: 'vehicle', label: vehicle?.model ?? (vehicles.length ? 'Vehicle' : 'No vehicle'), glyph: 'vehicle' },
              ]}
            />
          </View>
          <IconButton glyph="pie" fg={Colors.accent} onPress={() => router.push('/insights')} accessibilityLabel="Insights" />
        </View>

        {approval ? (
          <Pressable onPress={() => router.push(`/estimates/${approval.id}`)} style={({ pressed }) => [styles.approval, pressed && { opacity: 0.85 }]}>
            <Dot />
            <T numberOfLines={1} style={styles.approvalText}>
              {approval.workshopName} wants to add {approval.lines[0]?.description.toLowerCase() ?? 'work'} to the {approvalVehicle?.model ?? 'car'} · {formatMoney(approval.total, '')}
            </T>
            <IconGlyph glyph="open" size={24} bg="transparent" fg={Colors.accent} scale={0.9} />
          </Pressable>
        ) : accessRequests[0] ? (
          <Pressable onPress={() => router.push(`/access-requests/${accessRequests[0].id}`)} style={styles.approval}>
            <Dot />
            <T numberOfLines={1} style={styles.approvalText}>
              {accessRequests[0].workshopName} asked to see a vehicle
            </T>
            <IconGlyph glyph="open" size={24} bg="transparent" fg={Colors.accent} scale={0.9} />
          </Pressable>
        ) : null}

        <View style={styles.flex}>
          {vehicles.length === 0 && garage ? (
            <View style={styles.empty}>
              <T variant="display">Add the car you drive most.</T>
              <T variant="lede">Every fill, service and receipt then builds its history, and Home can answer what it costs you.</T>
              <Button onPress={() => router.push('/vehicle/add')} style={styles.emptyCta}>
                Add a vehicle
              </Button>
            </View>
          ) : null}
        </View>

        <View style={styles.suggestions}>
          {ownerSuggestions(vehicle ?? vehicles[0]).map((s) => (
            <Pressable key={s} onPress={() => ask(s)} style={({ pressed }) => [styles.suggestion, pressed && { opacity: 0.6 }]}>
              <IconGlyph glyph="search" size={22} bg="transparent" fg={Colors.textMuted} scale={0.86} />
              <T numberOfLines={1} style={styles.suggestionText}>
                {s}
              </T>
            </Pressable>
          ))}
        </View>

        <Composer
          value={text}
          onChangeText={setText}
          onSubmit={() => ask(text)}
          onAdd={() => setAdding(true)}
          scopeLabel={vehicle?.model ?? garage?.name ?? 'Garage'}
          onScope={() => setPicker('vehicle')}
          onMic={() => router.push({ pathname: '/assistant/listen', params: vehicle ? { vehicleId: vehicle.id } : {} })}
        />
        <View style={{ height: Spacing.sm }} />
      </KeyboardAvoidingView>

      <Drawer
        visible={drawer}
        onClose={() => setDrawer(false)}
        name={account?.name ?? ''}
        items={drawerItems}
        recents={recents}
        onRecent={ask}
        onNewChat={() => setText('')}
        switchLabel="Switch profile"
        onSwitch={() => {
          setDrawer(false);
          router.push('/profile-switch');
        }}
      />

      <OptionSheet
        visible={picker === 'garage'}
        title="Your garages"
        options={garages.map((g) => ({ key: g.id, label: g.name, meta: g.location.toUpperCase(), glyph: 'home', hue: Colors.positive, tint: Colors.positiveSoft }))}
        selected={garage?.id}
        onSelect={(id) => {
          setPicker(null);
          void setActiveGarage(id);
          void setUiState({ homeVehicleId: null });
        }}
        onClose={() => setPicker(null)}
        footer={
          <Button
            variant="secondary"
            size="md"
            glyph="add"
            onPress={() => {
              setPicker(null);
              router.push('/garages/add');
            }}>
            New garage
          </Button>
        }
      />

      <OptionSheet
        visible={picker === 'vehicle'}
        title="Ask about"
        options={[
          { key: '__garage', label: `The whole of ${garage?.name ?? 'the garage'}`, meta: `${vehicles.length} VEHICLES`, glyph: 'home', hue: Colors.positive, tint: Colors.positiveSoft },
          ...vehicles.map((v) => ({ key: v.id, label: `${v.make} ${v.model}`, meta: `${v.year} · ${v.usage.toUpperCase()}`, glyph: v.type === 'motorcycle' ? 'motorcycle' : 'vehicle' })),
        ]}
        selected={vehicle?.id ?? '__garage'}
        onSelect={(id) => {
          setPicker(null);
          void setUiState({ homeVehicleId: id === '__garage' ? null : id });
        }}
        onClose={() => setPicker(null)}
      />

      <OptionSheet
        visible={adding}
        title="Add a record"
        grid
        options={RECORD_CATEGORIES.map((c) => ({ key: c.key, label: c.label, glyph: c.glyph, ...CATEGORY_TINT[c.key] }))}
        onSelect={(key) => {
          setAdding(false);
          const c = RECORD_CATEGORIES.find((x) => x.key === key);
          if (c) router.push(categoryHref(c, vehicle?.id ?? vehicles[0]?.id) as never);
        }}
        onClose={() => setAdding(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 12,
  },
  alertDot: {
    position: 'absolute',
    top: 0,
    right: 0,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: Colors.white,
  },
  scope: {
    flex: 1,
    alignItems: 'center',
  },
  approval: {
    marginHorizontal: 14,
    height: 56,
    borderRadius: 52,
    backgroundColor: Colors.accentSoft,
    borderWidth: 1,
    borderColor: Colors.lineStrong,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingHorizontal: 16,
  },
  approvalText: {
    flex: 1,
    fontFamily: FontFamily.semiBold,
    fontSize: 14,
    color: Colors.accent,
  },
  empty: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xxl,
    gap: Spacing.sm,
  },
  emptyCta: {
    marginTop: Spacing.md,
  },
  suggestions: {
    paddingHorizontal: 18,
    paddingBottom: 14,
  },
  suggestion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 11,
    borderRadius: Radius.sm,
  },
  suggestionText: {
    flex: 1,
    fontSize: 15,
    color: Colors.ink,
  },
});
