import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { QueryBoundary } from '@/components/data/QueryBoundary';
import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { TextField } from '@/components/ui/TextField';
import { T } from '@/components/ui/Typography';
import { TopBar } from '@/components/ui/TopBar';
import { fetchProjectById } from '@/data/api/aggregates';
import { qk } from '@/data/queryKeys';
import { updateProjectBrief } from '@/data/repo';
import { formatMoney } from '@/lib/format';
import type { BuildBriefType, ProjectBuild } from '@/types/domain';
import { Colors, Radius, Spacing } from '@/theme/tokens';

const BRIEF_OPTIONS: { key: BuildBriefType; label: string; sub: string }[] = [
  { key: 'driver', label: 'Driver', sub: 'Reliable and used. Function over finish.' },
  { key: 'restomod', label: 'Restomod', sub: 'Original look, modern running gear.' },
  { key: 'concours', label: 'Concours', sub: 'Factory-correct to the fastener.' },
  { key: 'frame-off', label: 'Frame-off', sub: 'Stripped to the shell and rebuilt.' },
];

/**
 * There's no `useProject`-by-project-id hook in `@/data/hooks` (only
 * `useProject(vehicleId)`) — this screen only ever has the project id (from
 * the route), so it fetches directly via `fetchProjectById` (see
 * `@/data/api/aggregates`), which also seeds the stage caches the same way
 * `useProject` does. Replaces the old `@/data/store` scan for the project.
 */
function useProjectById(projectId: string | undefined) {
  return useQuery({
    queryKey: qk.project(projectId),
    queryFn: () => fetchProjectById(projectId!),
    enabled: !!projectId,
  });
}

export default function BuildBriefScreen() {
  const { projectId } = useLocalSearchParams<{ projectId: string }>();
  const projectQuery = useProjectById(projectId);
  const project = projectQuery.data;

  const [briefType, setBriefType] = useState<BuildBriefType | undefined>(undefined);
  const [budget, setBudget] = useState('');
  const [contingencyPct, setContingencyPct] = useState('20');
  const [saving, setSaving] = useState(false);
  const [hydratedForId, setHydratedForId] = useState<string | undefined>(undefined);

  // Pre-fill the form from the loaded project exactly once per project id —
  // after that, the user's own edits should win, even as background
  // refetches come in. Adjusting state during render (React's documented
  // pattern for "reset/derive state when a prop/query result changes")
  // rather than in a useEffect, so this doesn't cause an extra commit.
  if (project && hydratedForId !== project.id) {
    setHydratedForId(project.id);
    setBriefType(project.briefType);
    setBudget(String(project.budget));
    setContingencyPct(project.contingencyPct != null ? String(project.contingencyPct) : '20');
  }

  const budgetNum = Number(budget) || 0;
  const contingencyNum = Number(contingencyPct) || 0;
  const contingencyAmount = useMemo(() => (budgetNum * contingencyNum) / 100, [budgetNum, contingencyNum]);

  const save = async () => {
    if (!projectId) return;
    setSaving(true);
    await updateProjectBrief(projectId, { briefType, budget: budgetNum, contingencyPct: contingencyNum });
    setSaving(false);
    router.back();
  };

  return (
    <QueryBoundary query={projectQuery} isEmpty={() => false}>
      {(loaded: ProjectBuild) => {
        const stageCount = loaded.stages.length;
        return (
          <Screen header={<TopBar backLabel="BACK" />}
            scroll
            footer={
              <Button onPress={save} loading={saving}>
                Save brief{briefType ? ` · ${BRIEF_OPTIONS.find((o) => o.key === briefType)?.label ?? ''}` : ''}
              </Button>
            }>

            <T variant="display" style={styles.title}>
              What are you building?
            </T>
            <T variant="body" color={Colors.textMuted} style={styles.intro}>
              This sets your stage list, the estimates against each one, and how much you hold back for surprises. Change it
              whenever the plan changes.
            </T>

            <View style={styles.list}>
              {BRIEF_OPTIONS.map((o) => (
                <Pressable
                  key={o.key}
                  style={[styles.option, briefType === o.key && styles.optionSelected]}
                  onPress={() => setBriefType(o.key)}>
                  <T variant="bodyStrong">{o.label}</T>
                  <T variant="meta" style={styles.optionSub}>
                    {o.sub}
                  </T>
                </Pressable>
              ))}
            </View>

            <T variant="eyebrow" style={styles.fieldLabel}>
              BUILD BUDGET · {stageCount} STAGE{stageCount === 1 ? '' : 'S'}
            </T>
            <TextField value={budget} onChangeText={setBudget} keyboardType="numeric" prefix="KES" placeholder="0" />

            <T variant="eyebrow" style={styles.fieldLabel}>
              CONTINGENCY · {contingencyNum}%
            </T>
            <TextField
              value={contingencyPct}
              onChangeText={setContingencyPct}
              keyboardType="numeric"
              prefix="%"
              helper={`${formatMoney(contingencyAmount)} · HOLD BACK 15–25% FOR WHAT YOU FIND WHEN THE PANELS COME OFF. HIDDEN RUST AND RARE PARTS ARE WHERE BUILDS GO OVER.`}
            />
          </Screen>
        );
      }}
    </QueryBoundary>
  );
}

const styles = StyleSheet.create({
  title: {
    marginTop: Spacing.md,
    marginBottom: Spacing.xs,
  },
  intro: {
    marginBottom: Spacing.lg,
  },
  list: {
    gap: Spacing.xs,
    marginBottom: Spacing.xl,
  },
  option: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
    padding: Spacing.md,
    gap: 2,
  },
  optionSelected: {
    borderColor: Colors.accent,
    backgroundColor: Colors.accentSoft,
  },
  optionSub: {},
  fieldLabel: {
    marginTop: Spacing.lg,
    marginBottom: Spacing.xs,
  },
});
