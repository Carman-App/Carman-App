import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { T } from '@/components/ui/Typography';
import { TopBar } from '@/components/ui/TopBar';
import { useActiveWorkshop, useCurrency, useJobs } from '@/data/hooks';
import { pushRecent } from '@/data/uiState';
import { Composer } from '@/features/home/Composer';
import { answerMechanic, type MechAnswer } from '@/features/mechanic/answer';
import { Colors, FontFamily, Radius, Spacing } from '@/theme/tokens';

type Turn = { id: number; q: string; at: Date; a: MechAnswer | null };

/** The mechanic's answer thread: replies come from the workshop's own jobs and lines. */
export default function MechanicAskScreen() {
  const { q } = useLocalSearchParams<{ q?: string }>();
  const workshop = useActiveWorkshop().data;
  const jobsQ = useJobs(workshop?.id ?? undefined);
  const currency = useCurrency();
  const [turns, setTurns] = useState<Turn[]>(() => (q ? [{ id: 1, q, at: new Date(), a: null }] : []));
  const [text, setText] = useState('');
  const scroller = useRef<ScrollView>(null);
  const jobs = jobsQ.data;

  useEffect(() => {
    if (!jobs) return;
    if (turns.some((t) => !t.a)) setTurns((p) => p.map((t) => (t.a ? t : { ...t, a: answerMechanic(t.q, jobs, currency) })));
  }, [jobs, turns, currency]);

  const send = () => {
    const question = text.trim();
    if (!question) return;
    void pushRecent(question);
    setText('');
    setTurns((p) => [...p, { id: p.length + 1, q: question, at: new Date(), a: jobs ? answerMechanic(question, jobs, currency) : null }]);
    setTimeout(() => scroller.current?.scrollToEnd({ animated: true }), 50);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <TopBar title={workshop?.name ?? 'Workshop'} right="Open board" onRight={() => router.push('/mechanic/job-board')} />
        <ScrollView ref={scroller} style={styles.flex} contentContainerStyle={styles.thread}>
          {turns.map((t) => (
            <View key={t.id} style={styles.turn}>
              <T variant="meta" center>
                Today at {String(t.at.getHours()).padStart(2, '0')}:{String(t.at.getMinutes()).padStart(2, '0')}
              </T>
              <View style={styles.bubble}>
                <T color={Colors.accent}>{t.q}</T>
              </View>
              {t.a ? (
                <View style={styles.answer}>
                  {t.a.checked ? <T variant="meta">{t.a.checked}</T> : null}
                  <T style={styles.lead}>{t.a.lead}</T>
                  {t.a.body ? <T style={styles.body}>{t.a.body}</T> : null}
                  {t.a.jobIds?.length === 1 ? (
                    <Pressable onPress={() => router.push({ pathname: '/mechanic/job-detail', params: { id: t.a!.jobIds![0] } })}>
                      <T variant="section">Open the job →</T>
                    </Pressable>
                  ) : null}
                </View>
              ) : (
                <T variant="meta" color={Colors.textFaint}>
                  Reading the board…
                </T>
              )}
            </View>
          ))}
        </ScrollView>
        <Composer value={text} onChangeText={setText} onSubmit={send} placeholder="Ask about a job, part or customer" scopeLabel={workshop?.name ?? 'Workshop'} />
        <View style={{ height: Spacing.sm }} />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  flex: { flex: 1 },
  thread: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.lg, gap: Spacing.xl },
  turn: { gap: Spacing.sm },
  bubble: {
    alignSelf: 'flex-end',
    maxWidth: '82%',
    backgroundColor: Colors.accentSoft,
    borderRadius: Radius.lg,
    borderBottomRightRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  answer: { gap: Spacing.sm },
  lead: { fontFamily: FontFamily.bold, fontSize: 15, lineHeight: 23, color: Colors.ink },
  body: { fontSize: 15, lineHeight: 23, color: Colors.ink },
});
