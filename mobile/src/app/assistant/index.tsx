import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Dot } from '@/components/ui/Blocks';
import { Button } from '@/components/ui/Button';
import { T } from '@/components/ui/Typography';
import { TopBar } from '@/components/ui/TopBar';
import { pushRecent } from '@/data/uiState';
import { setDraft } from '@/features/assistant/draftStore';
import { answer, type Answer } from '@/features/assistant/engine';
import { askRemote, fallbackNote, turnText, type RemoteAnswer, type Turn } from '@/features/assistant/remote';
import { useAssistantContext } from '@/features/assistant/useAssistantContext';
import { Composer } from '@/features/home/Composer';
import { todayIso } from '@/lib/format';
import { Colors, FontFamily, Radius, Spacing } from '@/theme/tokens';

type TurnState = {
  id: number;
  q: string;
  at: Date;
  status: 'waiting' | 'done';
  a?: Answer & { draftExtras?: RemoteAnswer['draftExtras'] };
  note?: string | null;
};

function clock(d: Date) {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/**
 * Answer + draft. Claude answers from the garage's own records (server-side,
 * POST /api/v1/assistant); when the server has no key or can't be reached,
 * the on-device engine answers instead. When the question described
 * something that happened, an editable draft follows with "Check and save".
 * Nothing is saved on this screen.
 */
export default function AssistantScreen() {
  const { q, vehicleId } = useLocalSearchParams<{ q?: string; vehicleId?: string }>();
  const { ctx, loading, offline, garage } = useAssistantContext(vehicleId);
  const [turns, setTurns] = useState<TurnState[]>(() => (q ? [{ id: 1, q, at: new Date(), status: 'waiting' }] : []));
  const [text, setText] = useState('');
  const scroller = useRef<ScrollView>(null);
  const ctxRef = useRef(ctx);
  const started = useRef(new Set<number>());

  useEffect(() => {
    ctxRef.current = ctx;
  }, [ctx]);

  // Start any waiting turn once the garage (and its records, for the fallback) has loaded.
  useEffect(() => {
    if (!garage || loading) return;
    const waiting = turns.filter((t) => t.status === 'waiting' && !started.current.has(t.id));
    for (const turn of waiting) {
      started.current.add(turn.id);
      const history: Turn[] = turns
        .filter((t) => t.status === 'done' && t.id < turn.id && t.a)
        .slice(-6)
        .map((t) => ({ question: t.q, answer: turnText(t.a!) }));
      void askRemote({ mode: 'owner', question: turn.q, garageId: garage.id, vehicleId: ctxRef.current.vehicle?.id, history }).then((res) => {
        let a: TurnState['a'];
        let note: string | null = null;
        if (res.ok) a = res.answer;
        else if (res.reason === 'refused') a = { lead: res.message ?? 'Carma can’t help with that one.' };
        else {
          a = answer(turn.q, ctxRef.current);
          note = fallbackNote(res.reason);
        }
        setTurns((prev) => prev.map((t) => (t.id === turn.id ? { ...t, status: 'done', a, note } : t)));
        setTimeout(() => scroller.current?.scrollToEnd({ animated: true }), 50);
      });
    }
  }, [garage, loading, turns]);

  const send = () => {
    const question = text.trim();
    if (!question) return;
    void pushRecent(question);
    setText('');
    setTurns((prev) => [...prev, { id: prev.length + 1, q: question, at: new Date(), status: 'waiting' }]);
    setTimeout(() => scroller.current?.scrollToEnd({ animated: true }), 50);
  };

  const lastDraftTurn = [...turns].reverse().find((t) => t.a?.draft);
  const lastDraft = lastDraftTurn?.a?.draft;

  const checkAndSave = () => {
    if (!lastDraft) return;
    const extras = lastDraftTurn?.a?.draftExtras;
    const knownVehicle = extras?.vehicleId && ctx.vehicles.some((v) => v.id === extras.vehicleId) ? extras.vehicleId : undefined;
    setDraft({
      ...lastDraft,
      vehicleId: knownVehicle ?? ctx.vehicle?.id ?? ctx.vehicles[0]?.id,
      date: extras?.date && /^\d{4}-\d{2}-\d{2}$/.test(extras.date) ? extras.date : todayIso(),
      title: extras?.title,
      origin: 'assistant',
    });
    router.push('/record/review');
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <TopBar
          right={
            offline ? (
              <View style={styles.offline}>
                <Dot color={Colors.orange} />
                <T style={styles.offlineText}>Offline</T>
              </View>
            ) : (
              ctx.vehicle?.model ?? 'Whole garage'
            )
          }
        />
        <ScrollView ref={scroller} style={styles.flex} contentContainerStyle={styles.thread} keyboardShouldPersistTaps="handled">
          {turns.length === 0 ? (
            <T variant="lede" style={styles.hint}>
              Ask what something cost, when a document runs out, or describe a fill-up or service and Carma will draft the record.
            </T>
          ) : null}
          {turns.map((t) => (
            <View key={t.id} style={styles.turn}>
              <T variant="meta" center>
                Today at {clock(t.at)}
              </T>
              <View style={styles.bubble}>
                <T color={Colors.accent} style={styles.bubbleText}>
                  {t.q}
                </T>
              </View>
              {t.status === 'done' && t.a ? (
                <View style={styles.answer}>
                  {t.a.checked ? <T variant="meta">{t.a.checked}</T> : null}
                  <T style={styles.lead}>
                    {t.a.lead}
                    {t.a.body ? <T style={styles.body}> {t.a.body}</T> : null}
                  </T>
                  {t.a.draft ? <DraftCard answer={t.a} /> : null}
                  {t.note ? (
                    <T variant="small" color={Colors.textFaint}>
                      {t.note}
                    </T>
                  ) : null}
                  {t.a.link ? (
                    <Pressable onPress={() => router.push(t.a!.link!.href as never)} style={styles.link}>
                      <T variant="section">{t.a.link.label} →</T>
                    </Pressable>
                  ) : null}
                </View>
              ) : (
                <T variant="meta" color={Colors.textFaint}>
                  Reading your records…
                </T>
              )}
            </View>
          ))}
        </ScrollView>
        <View style={styles.footer}>
          {lastDraft ? (
            <Button onPress={checkAndSave} style={styles.cta}>
              Check and save
            </Button>
          ) : null}
          <Composer
            value={text}
            onChangeText={setText}
            onSubmit={send}
            placeholder={lastDraft ? 'Reply to Carma, or correct a field' : 'Ask a follow-up'}
            scopeLabel={ctx.vehicle?.model ?? 'Garage'}
            onMic={() => router.replace({ pathname: '/assistant/listen', params: ctx.vehicle ? { vehicleId: ctx.vehicle.id } : {} })}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function DraftCard({ answer: a }: { answer: Answer }) {
  const d = a.draft!;
  const rows: [string, string | undefined][] = [
    ['Kind', d.kind === 'expense' ? (d.category ?? 'expense') : d.kind],
    ['Amount', d.amount !== undefined ? d.amount.toLocaleString() : undefined],
    ['Litres', d.litres !== undefined ? String(d.litres) : undefined],
    ['Odometer', d.odometer !== undefined ? `${d.odometer.toLocaleString()} km` : undefined],
    ['Place', d.place],
  ];
  return (
    <View style={styles.draft}>
      {rows
        .filter(([, v]) => v !== undefined)
        .map(([k, v], i, arr) => (
          <View key={k} style={[styles.draftRow, i < arr.length - 1 && styles.draftRule]}>
            <T variant="eyebrow" color={Colors.slate}>
              {k}
            </T>
            <T variant="bodyStrong" style={{ textTransform: k === 'Kind' ? 'capitalize' : 'none' }}>
              {v}
            </T>
          </View>
        ))}
    </View>
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
  offline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.warningSoft,
    borderRadius: Radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  offlineText: {
    fontFamily: FontFamily.semiBold,
    fontSize: 12,
    color: Colors.orange,
  },
  thread: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
    gap: Spacing.xl,
  },
  hint: {
    paddingTop: Spacing.xl,
  },
  turn: {
    gap: Spacing.sm,
  },
  bubble: {
    alignSelf: 'flex-end',
    maxWidth: '82%',
    backgroundColor: Colors.accentSoft,
    borderRadius: Radius.lg,
    borderBottomRightRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bubbleText: {
    fontSize: 14,
    lineHeight: 20,
  },
  answer: {
    gap: Spacing.sm,
  },
  lead: {
    fontFamily: FontFamily.bold,
    fontSize: 15,
    lineHeight: 23,
    color: Colors.ink,
  },
  body: {
    fontFamily: FontFamily.regular,
    fontSize: 15,
    lineHeight: 23,
    color: Colors.ink,
  },
  link: {
    alignSelf: 'flex-start',
    paddingVertical: 4,
  },
  draft: {
    borderWidth: 1,
    borderColor: Colors.line,
    borderRadius: Radius.md,
    paddingHorizontal: 14,
  },
  draftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 11,
  },
  draftRule: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderSoft,
  },
  cta: {
    marginHorizontal: 14,
  },
  footer: {
    gap: Spacing.sm,
    paddingBottom: Spacing.sm,
  },
});
