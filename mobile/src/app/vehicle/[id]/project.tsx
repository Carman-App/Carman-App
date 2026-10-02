import { router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Card } from '@/components/ui/Card';
import { ListRow } from '@/components/ui/ListRow';
import { Screen } from '@/components/ui/Screen';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { T } from '@/components/ui/Typography';
import { TopBar } from '@/components/ui/TopBar';
import { QueryBoundary } from '@/components/data/QueryBoundary';
import { useProject, useVehicle } from '@/data/hooks';
import { queryClient } from '@/data/queryClient';
import { qk } from '@/data/queryKeys';
import { formatDateShort, formatMoney, formatNumber } from '@/lib/format';
import { USAGE_LABEL, type Modification, type PartLine } from '@/types/domain';
import { Colors, Radius, Spacing } from '@/theme/tokens';

const STATUS_LABEL: Record<string, string> = {
  'not-started': 'TO DO',
  'in-progress': 'IN PROGRESS',
  done: 'DONE',
};

export default function VehicleProjectScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const vehicleQuery = useVehicle(id);
  const vehicle = vehicleQuery.data;
  const projectQuery = useProject(id);
  const project = projectQuery.data;

  // There's no GET-by-id endpoint for a stage's modifications/parts — they're
  // seeded straight into the query cache as a side effect of fetching the
  // project (see @/data/api/aggregates's seedStageCaches, and useBuildStage/
  // useStageModifications/useStageParts in @/data/hooks, which read the same
  // cache). This project screen needs mods/parts across EVERY stage at once
  // (for stageActual/buildLog), which those per-stage hooks can't give
  // without a variable number of hook calls, so it reads the cache directly
  // here instead — safe because it's a plain synchronous read inside
  // `useMemo`, not a subscription, and `project` (whose identity changes on
  // every refetch) is in the dependency array, so this recomputes whenever
  // addModification/addPart's cache invalidation causes useProject to
  // refetch and re-seed the cache.
  const stageIds = useMemo(() => (project?.stages ?? []).map((s) => s.id), [project]);
  const mods = useMemo(
    () => stageIds.flatMap((stageId) => queryClient.getQueryData<Modification[]>(qk.stageModifications(stageId)) ?? []),
    [stageIds]
  );
  const parts = useMemo(
    () => stageIds.flatMap((stageId) => queryClient.getQueryData<PartLine[]>(qk.stageParts(stageId)) ?? []),
    [stageIds]
  );

  const stageActual = (stageId: string) =>
    mods.filter((m) => m.stageId === stageId).reduce((s, m) => s + m.cost, 0) +
    parts.filter((p) => p.stageId === stageId).reduce((s, p) => s + p.cost, 0);

  const doneStages = project ? project.stages.filter((s) => s.status === 'done').length : 0;
  const totalStages = project?.stages.length ?? 0;
  const completionPct = totalStages > 0 ? doneStages / totalStages : 0;
  const budgetUsedPct = project && project.budget > 0 ? project.spent / project.budget : 0;
  const contingency = project ? (project.budget * (project.contingencyPct ?? 0)) / 100 : 0;
  const forecast = project ? (completionPct > 0 ? project.spent / completionPct : project.budget) : 0;
  const stillToDo = project ? Math.max(project.budget - project.spent, 0) : 0;

  const buildLog = useMemo(() => {
    const stageName = (stageId: string) => project?.stages.find((s) => s.id === stageId)?.name ?? '';
    const modEntries = mods.map((m) => ({ id: m.id, name: m.name, date: m.date ?? '', stage: stageName(m.stageId), cost: m.cost }));
    const partEntries = parts.map((p) => ({ id: p.id, name: p.name, date: p.date ?? '', stage: stageName(p.stageId), cost: p.cost }));
    return [...modEntries, ...partEntries].sort((a, b) => (a.date < b.date ? 1 : -1));
  }, [mods, parts, project]);

  const partsInventory = useMemo(() => {
    const tally: Record<string, number> = { 'on-order': 0, 'in-storage': 0, fitted: 0 };
    for (const p of parts) {
      const key = p.status ?? 'in-storage';
      tally[key] = (tally[key] ?? 0) + 1;
    }
    return tally;
  }, [parts]);

  const daysSinceLastEntry = buildLog[0]?.date ? Math.max(0, -daysUntilSafe(buildLog[0].date)) : null;

  const targetStage = useMemo(() => {
    if (!project || project.stages.length === 0) return undefined;
    return project.stages.find((s) => s.status === 'in-progress') ?? project.stages[0];
  }, [project]);

  // Vehicle + project both gate loading/error (the page has nothing to show
  // without either). A vehicle legitimately having no project yet (never
  // started a build) still resolves `project` to `undefined` after a
  // successful fetch — same as the mock's "nothing to render" behaviour,
  // not an error.
  const primaryQuery = useMemo(
    () => ({
      data: vehicle && project ? ({ vehicle, project } as const) : undefined,
      isLoading: vehicleQuery.isLoading || projectQuery.isLoading,
      isError: vehicleQuery.isError || projectQuery.isError,
      error: vehicleQuery.error ?? projectQuery.error,
      refetch: () => {
        vehicleQuery.refetch();
        projectQuery.refetch();
      },
    }),
    [vehicle, project, vehicleQuery, projectQuery]
  );

  return (
    <Screen header={<TopBar backLabel="BACK" />} scroll contentStyle={styles.content}>
      <QueryBoundary query={primaryQuery} isEmpty={() => false}>
        {({ vehicle, project }) => (
          <>
      <View style={styles.headerRow}>
        <Pressable onPress={() => router.push(`/build/${project.id}/brief`)}>
          <T variant="eyebrowStrong" color={Colors.textMuted}>
            EDIT BRIEF
          </T>
        </Pressable>
      </View>

      <T variant="eyebrow">{project.briefType ? project.briefType.toUpperCase() : USAGE_LABEL[vehicle.usage]}</T>
      <T variant="display" style={styles.title}>
        {vehicle.make} {vehicle.model}
      </T>
      <T variant="body" color={Colors.textMuted}>
        {vehicle.year} · {vehicle.powertrain ? vehicle.powertrain.toUpperCase() : 'ENGINE N/A'} · {formatNumber(vehicle.odometerKm)} KM
      </T>

      <View style={styles.photo}>
        <T variant="meta">ADD PHOTO</T>
      </View>

      {daysSinceLastEntry != null ? (
        <Card style={styles.stalledBanner}>
          <T variant="eyebrowStrong" color={Colors.warning}>
            {daysSinceLastEntry} DAY{daysSinceLastEntry === 1 ? '' : 'S'} SINCE LAST ENTRY
          </T>
          <T variant="meta" color={Colors.warning}>
            THIS IS THE STRETCH WHERE BUILDS STALL. LOG SOMETHING SMALL.
          </T>
        </Card>
      ) : null}

      <T variant="eyebrow" style={styles.sectionLabel}>
        FORECAST AT COMPLETION
      </T>
      <T variant="numericLarge">{formatMoney(forecast)}</T>
      {forecast > project.budget ? (
        <T variant="meta" color={Colors.warning}>
          OVER BUDGET BY {formatMoney(forecast - project.budget, '')}
          {contingency >= forecast - project.budget ? ' · CONTINGENCY COVERS IT' : ''}
        </T>
      ) : null}

      <View style={styles.statGrid}>
        <Card style={styles.statCard}>
          <T variant="eyebrow">SPENT</T>
          <T variant="numeric">{formatMoney(project.spent)}</T>
        </Card>
        <Card style={styles.statCard}>
          <T variant="eyebrow">STILL TO DO</T>
          <T variant="numeric">{formatMoney(stillToDo)}</T>
        </Card>
      </View>
      <View style={styles.statGrid}>
        <Card style={styles.statCard}>
          <T variant="eyebrow">BUDGET</T>
          <T variant="numeric">{formatMoney(project.budget)}</T>
        </Card>
        <Card style={styles.statCard}>
          <T variant="eyebrow">COMPLETION</T>
          <T variant="numeric">{Math.round(completionPct * 100)}%</T>
        </Card>
      </View>
      <View style={styles.statGrid}>
        <Card style={styles.statCard}>
          <T variant="eyebrow">BUDGET USED</T>
          <T variant="numeric">{Math.round(budgetUsedPct * 100)}%</T>
        </Card>
        <Card style={styles.statCard}>
          <T variant="eyebrow">CONTINGENCY</T>
          <T variant="numeric">{formatMoney(contingency)}</T>
        </Card>
      </View>
      {Math.round(budgetUsedPct * 100) !== Math.round(completionPct * 100) ? (
        <T variant="meta" color={Colors.textMuted} style={styles.sectionLabel}>
          SPEND IS {budgetUsedPct > completionPct ? 'AHEAD OF' : 'BEHIND'} PROGRESS BY{' '}
          {Math.abs(Math.round(budgetUsedPct * 100) - Math.round(completionPct * 100))} POINTS
        </T>
      ) : null}

      <SectionHeader title="Stages · est vs actual" action={`${doneStages} / ${totalStages} DONE`} />
      <Card padded={false} style={styles.stagesCard}>
        {project.stages.map((s, i) => (
          <ListRow
            key={s.id}
            bordered={i < project.stages.length - 1}
            title={`${i + 1}. ${s.name}`}
            subtitle={STATUS_LABEL[s.status]}
            onPress={() => router.push(`/build/stage/${s.id}`)}
            style={styles.stageRow}
            right={
              <>
                <T variant="meta">EST {formatMoney(s.estimate ?? 0, '')}</T>
                <T variant="bodyStrong">ACT {formatMoney(stageActual(s.id), '')}</T>
              </>
            }
          />
        ))}
        {project.stages.length === 0 ? (
          <T variant="meta" style={styles.emptyStages}>
            No stages yet.
          </T>
        ) : null}
      </Card>

      <SectionHeader title="Parts inventory" />
      <View style={styles.inventoryRow}>
        <Card style={styles.inventoryCard}>
          <T variant="numeric">{partsInventory['on-order']}</T>
          <T variant="meta">ON ORDER</T>
        </Card>
        <Card style={styles.inventoryCard}>
          <T variant="numeric">{partsInventory['in-storage']}</T>
          <T variant="meta">IN STORAGE</T>
        </Card>
        <Card style={styles.inventoryCard}>
          <T variant="numeric">{partsInventory.fitted}</T>
          <T variant="meta">FITTED</T>
        </Card>
      </View>

      <SectionHeader title="Build log" />
      <Card padded={false} style={styles.stagesCard}>
        {buildLog.length === 0 ? (
          <T variant="meta" style={styles.emptyStages}>
            No entries logged yet.
          </T>
        ) : (
          buildLog.map((entry, i) => (
            <ListRow
              key={entry.id}
              bordered={i < buildLog.length - 1}
              title={entry.name}
              subtitle={entry.stage}
              style={styles.stageRow}
              right={
                <>
                  <T variant="meta">{entry.date ? formatDateShort(entry.date) : ''}</T>
                  <T variant="bodyStrong">{formatMoney(entry.cost, '')}</T>
                </>
              }
            />
          ))
        )}
      </Card>

      {targetStage ? (
        <View style={styles.bottomRow}>
          <Pressable
            style={styles.bottomBtn}
            onPress={() =>
              router.push(
                targetStage.status === 'in-progress'
                  ? `/build/stage/${targetStage.id}/add-modification`
                  : `/build/stage/${targetStage.id}`
              )
            }>
            <T variant="bodyStrong" color={Colors.white}>
              MODIFICATION
            </T>
          </Pressable>
          <Pressable
            style={styles.bottomBtn}
            onPress={() =>
              router.push(targetStage.status === 'in-progress' ? `/build/stage/${targetStage.id}/add-part` : `/build/stage/${targetStage.id}`)
            }>
            <T variant="bodyStrong" color={Colors.white}>
              PART
            </T>
          </Pressable>
        </View>
      ) : null}
          </>
        )}
      </QueryBoundary>
    </Screen>
  );
}

function daysUntilSafe(iso: string): number {
  if (!iso) return 0;
  const target = new Date(iso + 'T00:00:00').getTime();
  if (Number.isNaN(target)) return 0;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.round((target - today) / (1000 * 60 * 60 * 24));
}

const styles = StyleSheet.create({
  content: {
    paddingTop: Spacing.sm,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  title: {
    marginTop: Spacing.xxs,
  },
  photo: {
    alignItems: 'center',
    marginVertical: Spacing.lg,
  },
  stalledBanner: {
    marginBottom: Spacing.md,
    gap: 2,
  },
  sectionLabel: {
    marginTop: Spacing.sm,
  },
  statGrid: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  statCard: {
    flex: 1,
    gap: 2,
  },
  stagesCard: {
    padding: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  stageRow: {
    paddingHorizontal: Spacing.sm,
  },
  emptyStages: {
    padding: Spacing.md,
  },
  inventoryRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  inventoryCard: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  bottomRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  bottomBtn: {
    flex: 1,
    backgroundColor: Colors.accent,
    borderRadius: Radius.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
});
