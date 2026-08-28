import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { IconGlyph } from '@/components/ui/IconGlyph';
import { ListRow } from '@/components/ui/ListRow';
import { Screen } from '@/components/ui/Screen';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { TextField } from '@/components/ui/TextField';
import { T } from '@/components/ui/Typography';
import { QueryBoundary } from '@/components/data/QueryBoundary';
import { useAccount, useGarage, useGarageMembers, useGarages, useVehicles } from '@/data/hooks';
import { deleteGarage, updateGarage } from '@/data/repo';
import { formatDateShort, formatPlate } from '@/lib/format';
import { USAGE_LABEL } from '@/types/domain';
import { Colors, Spacing } from '@/theme/tokens';

const ROLE_LABEL: Record<string, string> = {
  owner: 'OWNER',
  member: 'MEMBER',
  pending: 'PENDING',
};

export default function GarageViewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const garageQuery = useGarage(id);
  const garagesQuery = useGarages();
  const vehiclesQuery = useVehicles(id);
  const membersQuery = useGarageMembers(id);
  const accountQuery = useAccount();

  const garageData = garageQuery.data;
  const garages = garagesQuery.data ?? [];
  const vehicles = vehiclesQuery.data ?? [];
  const members = membersQuery.data ?? [];
  const account = accountQuery.data;

  const [name, setName] = useState(garageData?.name ?? '');
  const [location, setLocation] = useState(garageData?.location ?? '');
  const [savingDetails, setSavingDetails] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [loadedGarageId, setLoadedGarageId] = useState(garageData?.id);

  if (garageData && garageData.id !== loadedGarageId) {
    setLoadedGarageId(garageData.id);
    setName(garageData.name);
    setLocation(garageData.location);
  }

  const onlyGarage = garages.length <= 1;

  const handleSaveDetails = async () => {
    if (!garageData) return;
    const dirty = name.trim() !== garageData.name || location.trim() !== garageData.location;
    if (!dirty || !name.trim()) return;
    setSavingDetails(true);
    setDetailsError(null);
    try {
      await updateGarage(garageData.id, { name: name.trim(), location: location.trim() });
    } catch (e) {
      setDetailsError(e instanceof Error ? e.message : 'Something went wrong. Try again.');
    } finally {
      setSavingDetails(false);
    }
  };

  const handleDelete = async () => {
    if (!garageData || onlyGarage) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteGarage(garageData.id);
      router.replace('/garages');
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : 'Something went wrong. Try again.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Screen scroll contentStyle={styles.content}>
      <Pressable onPress={() => router.back()}>
        <T variant="eyebrowStrong" color={Colors.accent}>
          ← BACK
        </T>
      </Pressable>

      <QueryBoundary query={garageQuery} isEmpty={() => false}>
        {(garage) => {
          const garageIndex = garages.findIndex((g) => g.id === garage.id);
          const dirty = name.trim() !== garage.name || location.trim() !== garage.location;
          return (
            <>
              <T variant="eyebrow" style={styles.eyebrow}>
                {garageIndex >= 0 ? garageIndex + 1 : 1} OF {garages.length} GARAGES
              </T>
              <T variant="display" style={styles.title}>
                {garage.name}
              </T>
              {account ? (
                <T variant="eyebrowStrong" color={Colors.accent}>
                  ON CARMA {account.plan.toUpperCase()}
                </T>
              ) : null}

              <View style={styles.statGrid}>
                <Card style={styles.statCard}>
                  <T variant="eyebrow">VEHICLES</T>
                  <T variant="numeric">{vehicles.length}</T>
                </Card>
                <Card style={styles.statCard}>
                  <T variant="eyebrow">MEMBERS</T>
                  <T variant="numeric">{members.length}</T>
                </Card>
              </View>

              <SectionHeader title="WHAT IS IN HERE" action={vehicles.length > 0 ? `${vehicles.length} VEHICLE${vehicles.length === 1 ? '' : 'S'}` : undefined} />
              {vehicles.length === 0 ? (
                <Card style={styles.emptyCard}>
                  <EmptyState glyph="vehicle" title="NONE YET" body="Add the first vehicle to this garage.">
                    <Button size="md" onPress={() => router.push('/vehicle/add')}>
                      Add a vehicle
                    </Button>
                  </EmptyState>
                </Card>
              ) : (
                <Card padded={false} style={styles.card}>
                  {vehicles.map((v, i) => (
                    <ListRow
                      key={v.id}
                      bordered={i < vehicles.length - 1}
                      left={<IconGlyph glyph={v.type === 'car' ? 'vehicle' : 'motorcycle'} size={40} />}
                      title={`${v.make} ${v.model}`}
                      subtitle={`${v.make.toUpperCase()} · ${formatPlate(v.plate)} · ${USAGE_LABEL[v.usage]}`}
                      onPress={() => router.push(`/vehicle/${v.id}`)}
                    />
                  ))}
                </Card>
              )}

              <SectionHeader title="GARAGE DETAILS" />
              <Card style={styles.detailsCard}>
                <TextField label="NAME" value={name} onChangeText={setName} placeholder="Garage name" />
                <View style={styles.fieldGap} />
                <TextField label="TOWN" value={location} onChangeText={setLocation} placeholder="Town" />
                {detailsError ? (
                  <T variant="meta" color={Colors.danger} style={styles.detailsError}>
                    {detailsError}
                  </T>
                ) : null}
                <View style={styles.saveRow}>
                  <Button size="md" variant="secondary" loading={savingDetails} disabled={!dirty || !name.trim()} onPress={handleSaveDetails}>
                    {dirty ? 'Save changes' : 'Nothing to save'}
                  </Button>
                </View>
              </Card>

              <SectionHeader title="WHO IS IN HERE" />
              <Card padded={false} style={styles.card} onPress={() => router.push(`/garages/${garage.id}/members`)}>
                <T variant="meta" style={styles.seatsLabel}>
                  {members.length} OF 4 SEATS USED
                </T>
                {members.map((m, i) => (
                  <ListRow
                    key={m.id}
                    bordered={i < members.length - 1}
                    title={m.name}
                    subtitle={`${ROLE_LABEL[m.role] ?? m.role.toUpperCase()} · ${
                      account?.email && m.email === account.email ? 'YOU' : m.joinedAt ? `JOINED ${formatDateShort(m.joinedAt)}` : 'NOT JOINED YET'
                    }`}
                    meta={ROLE_LABEL[m.role] ?? m.role.toUpperCase()}
                  />
                ))}
              </Card>
              <Button variant="ghost" style={styles.inviteBtn} onPress={() => router.push(`/garages/${garage.id}/invite`)}>
                + Invite member
              </Button>

              <View style={styles.dangerZone}>
                {deleteError ? (
                  <T variant="meta" color={Colors.danger} style={styles.dangerHelper}>
                    {deleteError}
                  </T>
                ) : null}
                <Button variant="danger" disabled={onlyGarage} loading={deleting} onPress={handleDelete}>
                  Delete this garage
                </Button>
                {onlyGarage ? (
                  <T variant="meta" style={styles.dangerHelper}>
                    YOU CANNOT DELETE YOUR ONLY GARAGE.
                  </T>
                ) : null}
              </View>
            </>
          );
        }}
      </QueryBoundary>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: Spacing.sm,
  },
  eyebrow: {
    marginTop: Spacing.md,
  },
  title: {
    marginTop: Spacing.xxs,
    marginBottom: Spacing.xs,
  },
  statGrid: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  statCard: {
    flex: 1,
    gap: 2,
  },
  card: {
    padding: Spacing.md,
    marginBottom: Spacing.lg,
  },
  emptyCard: {
    marginBottom: Spacing.lg,
  },
  detailsCard: {
    marginBottom: Spacing.lg,
  },
  fieldGap: {
    height: Spacing.md,
  },
  saveRow: {
    marginTop: Spacing.md,
  },
  detailsError: {
    marginTop: Spacing.sm,
  },
  seatsLabel: {
    paddingTop: 2,
    paddingBottom: Spacing.xs,
  },
  inviteBtn: {
    marginBottom: Spacing.xl,
  },
  dangerZone: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
    paddingTop: Spacing.lg,
    gap: Spacing.xs,
  },
  dangerHelper: {
    textAlign: 'center',
  },
});
