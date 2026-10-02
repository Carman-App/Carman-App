import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { QueryBoundary } from '@/components/data/QueryBoundary';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ListRow } from '@/components/ui/ListRow';
import { Screen } from '@/components/ui/Screen';
import { T } from '@/components/ui/Typography';
import { fetchProjectById } from '@/data/api/aggregates';
import { useBuildStage, useStageModifications, useStageParts } from '@/data/hooks';
import { qk } from '@/data/queryKeys';
import { updateStageStatus } from '@/data/repo';
import { formatDateShort, formatMoney } from '@/lib/format';
import type { BuildStage } from '@/types/domain';
import { Colors, Radius, Spacing } from '@/theme/tokens';

const STATUS_LABEL: Record<string, string> = {
  'not-started': 'TO DO',
  'in-progress': 'IN PROGRESS',
  done: 'DONE',
};

/**
 * There's no GET-by-id endpoint for "the project this stage belongs to" —
 * once the stage itself is loaded (from the cache seeded by a project fetch,
 * see `useBuildStage`), its `projectId` is used to fetch the full project
 * directly via `fetchProjectById`. Replaces the old `@/data/store` scan that
 * searched every cached project for one containing this stage id.
 */
function useProjectForStage(projectId: string | undefined) {
  return useQuery({
    queryKey: qk.project(projectId),
    queryFn: () => fetchProjectById(projectId!),
    enabled: !!projectId,
  });
}

export default function BuildStageScreen() {
  const { stageId } = useLocalSearchParams<{ stageId: string }>();
  // `useBuildStage` reads straight from `queryClient.getQueryData` without a
  // type argument (see hooks.ts), so its `data` comes back as `unknown` —
  // cast here to the type it actually holds (seeded by `seedStageCaches`).
  const stageQuery = useBuildStage(stageId) as UseQueryResult<BuildStage, Error>;
  const modsQuery = useStageModifications(stageId);
  const partsQuery = useStageParts(stageId);
  const projectQuery = useProjectForStage(stageQuery.data?.projectId);
  const [updating, setUpdating] = useState(false);

  const mods = useMemo(() => modsQuery.data ?? [], [modsQuery.data]);
  const parts = useMemo(() => partsQuery.data ?? [], [partsQuery.data]);
  const project = projectQuery.data;

  const actual = useMemo(
    () => mods.reduce((s, m) => s + m.cost, 0) + parts.reduce((s, p) => s + p.cost, 0),
    [mods, parts]
  );
  const estimate = stageQuery.data?.estimate ?? 0;
  const leftInEstimate = estimate - actual;
  const pctOfBudget = project && project.budget > 0 ? (estimate / project.budget) * 100 : 0;

  const entries = useMemo(() => {
    const modEntries = mods.map((m) => ({ id: m.id, name: m.name, date: m.date ?? '', category: m.area ?? 'other', cost: m.cost }));
    const partEntries = parts.map((p) => ({ id: p.id, name: p.name, date: p.date ?? '', category: p.status ?? 'part', cost: p.cost }));
    return [...modEntries, ...partEntries].sort((a, b) => (a.date < b.date ? 1 : -1));
  }, [mods, parts]);

  const markDone = async () => {
    if (!stageId) return;
    setUpdating(true);
    await updateStageStatus(stageId, 'done');
    setUpdating(false);
    router.back();
  };

  return (
    <QueryBoundary query={stageQuery} isEmpty={() => false}>
      {(stage: BuildStage) => (
        <Screen
          scroll
          contentStyle={styles.content}
          footer={
            stage.status !== 'done' ? (
              <Button onPress={markDone} loading={updating}>
                Mark stage done
              </Button>
            ) : undefined
          }>
          <Pressable onPress={() => router.back()}>
            <T variant="eyebrowStrong" color={Colors.accent}>
              ← BACK
            </T>
          </Pressable>

          <View style={styles.badge}>
            <T variant="eyebrowStrong" color={stage.status === 'done' ? Colors.accent : stage.status === 'in-progress' ? Colors.progress : Colors.textFaint}>
              {STATUS_LABEL[stage.status]}
            </T>
          </View>
          <T variant="display" style={styles.title}>
            {stage.name}
          </T>
          <T variant="body" color={Colors.textMuted}>
            {entries.length} entr{entries.length === 1 ? 'y' : 'ies'} logged so far
          </T>

          <View style={styles.statGrid}>
            <Card style={styles.statCard}>
              <T variant="eyebrow">ESTIMATE</T>
              <T variant="numeric">{formatMoney(estimate)}</T>
            </Card>
            <Card style={styles.statCard}>
              <T variant="eyebrow">ACTUAL</T>
              <T variant="numeric">{formatMoney(actual)}</T>
            </Card>
          </View>

          <Card style={styles.leftCard}>
            <T variant="eyebrow" color={leftInEstimate < 0 ? Colors.danger : Colors.textMuted}>
              {leftInEstimate < 0 ? 'OVER ESTIMATE' : 'LEFT IN ESTIMATE'}
            </T>
            <T variant="numeric" color={leftInEstimate < 0 ? Colors.danger : Colors.text}>
              {formatMoney(Math.abs(leftInEstimate))}
            </T>
            <T variant="meta">{pctOfBudget.toFixed(1)}% OF TOTAL BUILD BUDGET</T>
          </Card>

          <T variant="eyebrow" style={styles.sectionLabel}>
            ENTRIES · {entries.length} ENTR{entries.length === 1 ? 'Y' : 'IES'}
          </T>
          <Card padded={false} style={styles.entriesCard}>
            {entries.length === 0 ? (
              <T variant="meta" style={styles.emptyEntries}>
                Nothing logged for this stage yet.
              </T>
            ) : (
              entries.map((e, i) => (
                <ListRow
                  key={e.id}
                  bordered={i < entries.length - 1}
                  title={e.name}
                  subtitle={String(e.category).toUpperCase()}
                  style={styles.row}
                  right={
                    <>
                      <T variant="meta">{e.date ? formatDateShort(e.date) : ''}</T>
                      <T variant="bodyStrong">{formatMoney(e.cost, '')}</T>
                    </>
                  }
                />
              ))
            )}
          </Card>

          <T variant="meta" style={styles.tip}>
            PHOTOGRAPH BEFORE YOU TAKE ANYTHING APART. LABEL THE HARDWARE.
          </T>

          <View style={styles.bottomRow}>
            <Pressable style={styles.bottomBtn} onPress={() => router.push(`/build/stage/${stageId}/add-modification`)}>
              <T variant="bodyStrong" color={Colors.white}>
                WORK
              </T>
            </Pressable>
            <Pressable style={styles.bottomBtn} onPress={() => router.push(`/build/stage/${stageId}/add-part`)}>
              <T variant="bodyStrong" color={Colors.white}>
                PART
              </T>
            </Pressable>
          </View>
        </Screen>
      )}
    </QueryBoundary>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: Spacing.sm,
  },
  badge: {
    marginTop: Spacing.md,
  },
  title: {
    marginTop: Spacing.xxs,
  },
  statGrid: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  statCard: {
    flex: 1,
    gap: 2,
  },
  leftCard: {
    gap: 2,
    marginBottom: Spacing.lg,
  },
  sectionLabel: {
    marginBottom: Spacing.xs,
  },
  entriesCard: {
    padding: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  row: {
    paddingHorizontal: Spacing.sm,
  },
  emptyEntries: {
    padding: Spacing.md,
  },
  tip: {
    marginBottom: Spacing.lg,
  },
  bottomRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  bottomBtn: {
    flex: 1,
    backgroundColor: Colors.accent,
    borderRadius: Radius.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
});
