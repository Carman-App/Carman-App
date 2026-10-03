import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '@/components/ui/Avatar';
import { Button, IconButton } from '@/components/ui/Button';
import { ToggleTrack } from '@/components/ui/Chip';
import { IconGlyph } from '@/components/ui/IconGlyph';
import { T } from '@/components/ui/Typography';
import { useAccount, useActiveWorkshop, useJobs, useUiState } from '@/data/hooks';
import { pushRecent } from '@/data/uiState';
import { Composer } from '@/features/home/Composer';
import { Drawer, type DrawerItem } from '@/features/home/Drawer';
import { MECH_SUGGESTIONS } from '@/features/mechanic/answer';
import { STATUS_META } from '@/features/mechanic/jobs';
import { Colors, FontFamily, Spacing } from '@/theme/tokens';

/** Mechanic home: same shape as the owner's, a different question, and the board one tap away. */
export default function MechanicHomeScreen() {
  const account = useAccount().data;
  const workshopQ = useActiveWorkshop();
  const workshop = workshopQ.data;
  const jobsData = useJobs(workshop?.id ?? undefined).data;
  const jobs = useMemo(() => jobsData ?? [], [jobsData]);
  const recents = useUiState('mechanicRecents');
  const [text, setText] = useState('');
  const [drawer, setDrawer] = useState(false);

  const counts = useMemo(() => {
    const inShop = jobs.filter((j) => ['APPROVED', 'IN_PROGRESS', 'AWAITING_APPROVAL', 'INTAKE'].includes(j.status)).length;
    const collect = jobs.filter((j) => STATUS_META[j.status].group === 'ready').length;
    return { inShop, collect };
  }, [jobs]);

  const ask = (q: string) => {
    const question = q.trim();
    if (!question) return;
    void pushRecent(question);
    setText('');
    router.push({ pathname: '/mechanic/ask', params: { q: question } });
  };

  const items: DrawerItem[] = [
    { label: 'Job board', glyph: 'service', hue: Colors.positive, tint: Colors.positiveSoft, href: '/mechanic/job-board' },
    { label: 'Customers', glyph: 'members', hue: Colors.teal, tint: Colors.tealSoft, href: '/mechanic/customers' },
    { label: 'Workshop insights', glyph: 'insights', hue: Colors.accent, tint: Colors.accentSoft, href: '/mechanic/insights' },
    { label: 'Reminders and notifications', glyph: 'reminder', hue: Colors.orange, tint: Colors.warningSoft, href: '/notifications' },
  ];

  if (workshopQ.isSuccess && !workshop) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.empty}>
          <T variant="display">Set up your workshop</T>
          <T variant="lede">Country and business name, and the job board is ready.</T>
          <Button onPress={() => router.push('/onboarding/workshop')}>Create the workshop</Button>
          <Button variant="ghost" size="md" onPress={() => router.replace('/profile-switch')}>
            Switch profile
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <Pressable onPress={() => setDrawer(true)} accessibilityLabel="Open menu">
            <Avatar name={workshop?.name ?? 'Workshop'} size={44} bg={Colors.ink} color={Colors.white} />
          </Pressable>
          <View style={styles.scope}>
            <ToggleTrack
              value="workshop"
              onChange={(k) => (k === 'jobs' ? router.push('/mechanic/job-board') : null)}
              options={[
                { key: 'workshop', label: 'Workshop' },
                { key: 'jobs', label: 'Jobs' },
              ]}
            />
          </View>
          <IconButton glyph="pie" fg={Colors.accent} onPress={() => router.push('/mechanic/insights')} accessibilityLabel="Workshop insights" />
        </View>
        <Pressable onPress={() => router.push('/mechanic/job-board')} style={styles.status}>
          <T style={styles.statusText}>
            {counts.inShop} in the workshop · {counts.collect} to collect
          </T>
        </Pressable>
        <View style={styles.flex} />
        <View style={styles.suggestions}>
          {MECH_SUGGESTIONS.map((s) => (
            <Pressable key={s} onPress={() => ask(s)} style={styles.suggestion}>
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
          placeholder="Job, part, customer, plate…"
          onAdd={() => router.push('/mechanic/new-job')}
          scopeLabel={workshop?.name ?? 'Workshop'}
          onMic={() => router.push({ pathname: '/assistant/listen', params: { to: 'mechanic', context: workshop?.name ?? 'Workshop' } })}
        />
        <View style={{ height: Spacing.sm }} />
      </KeyboardAvoidingView>
      <Drawer
        visible={drawer}
        onClose={() => setDrawer(false)}
        name={account?.name ?? ''}
        items={items}
        recents={recents}
        onRecent={ask}
        onNewChat={() => setText('')}
        switchLabel="Switch profile"
        onSwitch={() => {
          setDrawer(false);
          router.push('/profile-switch');
        }}
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
  empty: {
    flex: 1,
    justifyContent: 'center',
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 12,
  },
  scope: {
    flex: 1,
    alignItems: 'center',
  },
  status: {
    marginHorizontal: 14,
    height: 56,
    borderRadius: 52,
    backgroundColor: Colors.accentSoft,
    borderWidth: 1,
    borderColor: Colors.lineStrong,
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
  },
  statusText: {
    fontFamily: FontFamily.semiBold,
    fontSize: 14,
    color: Colors.accent,
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
  },
  suggestionText: {
    flex: 1,
    fontSize: 15,
    color: Colors.ink,
  },
});
