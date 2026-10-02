import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { T } from '@/components/ui/Typography';
import { TopBar } from '@/components/ui/TopBar';
import { addJobLine, useActiveWorkshop, useCurrency, useJob, useJobs } from '@/data/hooks';
import { pushRecent } from '@/data/uiState';
import { askRemoteStream, fallbackNote, turnText, type JobLineDraft, type Turn } from '@/features/assistant/remote';
import { Composer } from '@/features/home/Composer';
import { answerMechanic, type MechAnswer } from '@/features/mechanic/answer';
import { jobNumber } from '@/features/mechanic/jobs';
import { formatNumber } from '@/lib/format';
import { Colors, FontFamily, Radius, Spacing } from '@/theme/tokens';

type TurnState = {
  id: number;
  q: string;
  at: Date;
  status: 'waiting' | 'done';
  a?: MechAnswer;
  note?: string | null;
  link?: { label: string; href: string };
  lines?: JobLineDraft[];
  partial?: { lead: string; body: string };
};

const KIND_LABEL: Record<JobLineDraft['kind'], string> = { PART: 'Part', LABOUR: 'Labour', SERVICE: 'Service', FLUID: 'Fluid' };
const SOURCE_LABEL: Record<JobLineDraft['priceSource'], string> = { said: 'Price you said', history: 'Last price charged here', missing: 'Needs a price' };

/**
 * The mechanic's answer thread. Claude answers from the workshop's own jobs
 * (streamed as it writes), with the on-device engine as fallback. Opened on
 * a job (jobId), a description of the work becomes drafted estimate lines:
 * check them, fill any missing price, then "Check and send" adds them to the
 * job and opens "Before it sends".
 */
export default function MechanicAskScreen() {
  const { q, jobId } = useLocalSearchParams<{ q?: string; jobId?: string }>();
  const workshop = useActiveWorkshop().data;
  const jobsQ = useJobs(workshop?.id ?? undefined);
  const job = useJob(jobId).data;
  const currency = useCurrency();
  const [turns, setTurns] = useState<TurnState[]>(() => (q ? [{ id: 1, q, at: new Date(), status: 'waiting' }] : []));
  const [text, setText] = useState('');
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const scroller = useRef<ScrollView>(null);
  const started = useRef(new Set<number>());
  const jobs = jobsQ.data;

  useEffect(() => {
    if (!workshop || !jobs) return;
    for (const turn of turns.filter((t) => t.status === 'waiting' && !started.current.has(t.id))) {
      started.current.add(turn.id);
      const history: Turn[] = turns
        .filter((t) => t.status === 'done' && t.id < turn.id && t.a)
        .slice(-6)
        .map((t) => ({ question: t.q, answer: turnText(t.a!) }));
      const onPartial = (partial: { lead: string; body: string }) => {
        setTurns((prev) => prev.map((t) => (t.id === turn.id ? { ...t, partial } : t)));
        scroller.current?.scrollToEnd({ animated: false });
      };
      void askRemoteStream({ mode: 'mechanic', question: turn.q, workshopId: workshop.id, jobId, history }, onPartial).then((res) => {
        let a: MechAnswer;
        let note: string | null = null;
        let link: TurnState['link'];
        let lines: JobLineDraft[] | undefined;
        if (res.ok) {
          a = { lead: res.answer.lead, body: res.answer.body, checked: res.answer.checked, jobIds: res.answer.jobIds };
          link = res.answer.link;
          lines = res.answer.lines.length ? res.answer.lines : undefined;
        } else if (res.reason === 'refused') a = { lead: res.message ?? 'Carma can’t help with that one.' };
        else {
          a = answerMechanic(turn.q, jobs, currency);
          note = jobId
            ? 'Drafting estimate lines needs the Carma assistant on the server. Add the lines by hand from the job for now.'
            : fallbackNote(res.reason);
        }
        setTurns((prev) => prev.map((t) => (t.id === turn.id ? { ...t, status: 'done', a, note, link, lines, partial: undefined } : t)));
        setTimeout(() => scroller.current?.scrollToEnd({ animated: true }), 50);
      });
    }
  }, [workshop, jobs, turns, currency, jobId]);

  const send = () => {
    const question = text.trim();
    if (!question) return;
    void pushRecent(question);
    setText('');
    setTurns((p) => [...p, { id: p.length + 1, q: question, at: new Date(), status: 'waiting' }]);
    setTimeout(() => scroller.current?.scrollToEnd({ animated: true }), 50);
  };

  // The newest drafted lines are the ones "Check and send" adds.
  const linesTurn = [...turns].reverse().find((t) => t.lines?.length);
  const editKey = (i: number) => `${linesTurn?.id}:${i}`;
  const finalLines = (linesTurn?.lines ?? []).map((l, i) => {
    const typed = edits[editKey(i)];
    const cost = typed !== undefined ? Number(typed.replace(/[,\s]/g, '')) || 0 : l.cost;
    return { ...l, cost };
  });
  const total = finalLines.reduce((s, l) => s + l.cost, 0);
  const missing = finalLines.filter((l) => l.cost <= 0).length;

  const checkAndSend = async () => {
    if (!job) return;
    setSending(true);
    setSendError(null);
    try {
      for (const l of finalLines) await addJobLine(job, { kind: l.kind, description: l.description, cost: l.cost });
      if (job.status === 'INTAKE') router.replace({ pathname: '/mechanic/estimate-builder', params: { jobId: job.id } });
      else router.replace({ pathname: '/mechanic/job-detail', params: { id: job.id } });
    } catch (e) {
      setSendError(e instanceof Error ? e.message : 'Could not add the lines.');
      setSending(false);
    }
  };

  const title = job ? `Job ${jobNumber(job, jobs?.length ? jobs : [job])} · ${job.vehicleDescription?.split('·')[0]?.trim() ?? job.customer?.name ?? ''}` : (workshop?.name ?? 'Workshop');

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <TopBar
          title={title}
          right={job ? 'Open job' : 'Open board'}
          onRight={() => (job ? router.push({ pathname: '/mechanic/job-detail', params: { id: job.id } }) : router.push('/mechanic/job-board'))}
        />
        <ScrollView ref={scroller} style={styles.flex} contentContainerStyle={styles.thread} keyboardShouldPersistTaps="handled">
          {turns.length === 0 && job ? (
            <T variant="lede" style={styles.hint}>
              Describe the work on {job.customer?.name ?? 'this job'}’s vehicle: what you found, what you fitted, what needs quoting. Carma drafts the lines.
            </T>
          ) : null}
          {turns.map((t) => (
            <View key={t.id} style={styles.turn}>
              <T variant="meta" center>
                Today at {String(t.at.getHours()).padStart(2, '0')}:{String(t.at.getMinutes()).padStart(2, '0')}
              </T>
              <View style={styles.bubble}>
                <T color={Colors.accent}>{t.q}</T>
              </View>
              {t.status === 'done' && t.a ? (
                <View style={styles.answer}>
                  {t.a.checked ? <T variant="meta">{t.a.checked}</T> : null}
                  <T style={styles.lead}>{t.a.lead}</T>
                  {t.a.body ? <T style={styles.body}>{t.a.body}</T> : null}
                  {t.note ? (
                    <T variant="small" color={Colors.textFaint}>
                      {t.note}
                    </T>
                  ) : null}
                  {t.lines?.length ? (
                    <View style={styles.lines}>
                      {t.lines.map((l, i) => {
                        const isCurrent = t.id === linesTurn?.id;
                        const shown = isCurrent ? finalLines[i] : l;
                        const needs = shown.cost <= 0;
                        return (
                          <View key={i} style={[styles.line, i > 0 && styles.lineRule, needs && styles.lineMissing]}>
                            <View style={styles.flex}>
                              <T variant="bodyStrong">{l.description}</T>
                              <T variant="eyebrow" color={needs ? Colors.warning : Colors.slate}>
                                {KIND_LABEL[l.kind]} · {needs ? 'NEEDS A PRICE' : SOURCE_LABEL[l.priceSource].toUpperCase()}
                              </T>
                            </View>
                            {isCurrent ? (
                              <TextInput
                                value={edits[editKey(i)] ?? (l.cost ? formatNumber(l.cost) : '')}
                                onChangeText={(v) => setEdits((p) => ({ ...p, [editKey(i)]: v }))}
                                placeholder="0"
                                placeholderTextColor={Colors.warning}
                                keyboardType="number-pad"
                                style={styles.cost}
                              />
                            ) : (
                              <T variant="body" color={Colors.ink}>
                                {formatNumber(l.cost)}
                              </T>
                            )}
                          </View>
                        );
                      })}
                      {t.id === linesTurn?.id ? (
                        <View style={[styles.line, styles.lineRule]}>
                          <T variant="bodyStrong" style={styles.flex}>
                            Total
                          </T>
                          <T style={styles.total}>
                            {currency} {formatNumber(total)}
                          </T>
                        </View>
                      ) : null}
                    </View>
                  ) : null}
                  {t.link ? (
                    <Pressable onPress={() => router.push(t.link!.href as never)}>
                      <T variant="section">{t.link.label} →</T>
                    </Pressable>
                  ) : t.a.jobIds?.length === 1 ? (
                    <Pressable onPress={() => router.push({ pathname: '/mechanic/job-detail', params: { id: t.a!.jobIds![0] } })}>
                      <T variant="section">Open the job →</T>
                    </Pressable>
                  ) : null}
                </View>
              ) : t.partial ? (
                <View style={styles.answer}>
                  <T style={styles.lead}>{t.partial.lead}</T>
                  <T style={styles.body}>
                    {t.partial.body}
                    <T style={styles.caret}> ▍</T>
                  </T>
                </View>
              ) : (
                <T variant="meta" color={Colors.textFaint}>
                  {jobId ? 'Reading the job and its past visits…' : 'Reading the board…'}
                </T>
              )}
            </View>
          ))}
        </ScrollView>
        <View style={styles.footer}>
          {linesTurn && job ? (
            <>
              {sendError ? (
                <T variant="meta" color={Colors.danger} center>
                  {sendError}
                </T>
              ) : null}
              <Button style={styles.cta} loading={sending} disabled={missing > 0} onPress={checkAndSend}>
                {missing > 0 ? `${missing} line${missing === 1 ? ' needs' : 's need'} a price` : 'Check and send'}
              </Button>
            </>
          ) : null}
          <Composer
            value={text}
            onChangeText={setText}
            onSubmit={send}
            placeholder={job ? 'Correct a line, or add the discs' : 'Ask about a job, part or customer'}
            scopeLabel={job ? `Job ${jobNumber(job, jobs?.length ? jobs : [job])}` : (workshop?.name ?? 'Workshop')}
            onMic={() =>
              router.replace({
                pathname: '/assistant/listen',
                params: { to: 'mechanic', ...(job ? { jobId: job.id, context: title } : { context: workshop?.name ?? 'Workshop' }) },
              })
            }
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  flex: { flex: 1, gap: 4 },
  thread: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.lg, gap: Spacing.xl },
  hint: { paddingTop: Spacing.xl },
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
  caret: { color: Colors.accent },
  lines: { borderWidth: 1, borderColor: Colors.line, borderRadius: Radius.md, overflow: 'hidden' },
  line: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: 14, paddingVertical: 11 },
  lineRule: { borderTopWidth: 1, borderTopColor: Colors.borderSoft },
  lineMissing: { backgroundColor: Colors.ctaSoft },
  cost: {
    width: 88,
    flexGrow: 0,
    flexShrink: 0,
    textAlign: 'right',
    fontFamily: FontFamily.medium,
    fontSize: 14,
    color: Colors.ink,
    borderBottomWidth: 1,
    borderBottomColor: Colors.line,
    paddingVertical: 2,
    outlineWidth: 0,
  },
  total: { fontFamily: FontFamily.bold, fontSize: 16, color: Colors.ink },
  footer: { gap: Spacing.sm, paddingBottom: Spacing.sm },
  cta: { marginHorizontal: 14 },
});
