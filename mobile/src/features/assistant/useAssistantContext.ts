import { useMemo } from 'react';

import { useAccount, useActiveGarage, useGarageDocuments, useGarageRecords, useGarageReminders, useUiState, useVehicles } from '@/data/hooks';
import type { AssistantContext } from '@/features/assistant/engine';
import { REGION_UNITS } from '@/types/domain';

/** Everything the answer engine reads, scoped by the Home vehicle chip. */
export function useAssistantContext(vehicleIdOverride?: string) {
  const account = useAccount().data;
  const garage = useActiveGarage().data;
  const vehiclesQ = useVehicles(garage?.id);
  const recordsQ = useGarageRecords(garage?.id);
  const remindersQ = useGarageReminders(garage?.id);
  const documentsQ = useGarageDocuments(garage?.id);
  const homeVehicleId = useUiState('homeVehicleId');
  const vehicleId = vehicleIdOverride ?? homeVehicleId;

  const ctx: AssistantContext = useMemo(() => {
    const vehicles = vehiclesQ.data ?? [];
    return {
      currency: account ? REGION_UNITS[account.region]?.currency ?? 'KES' : 'KES',
      vehicles,
      vehicle: vehicles.find((v) => v.id === vehicleId),
      records: recordsQ.data ?? [],
      reminders: remindersQ.data ?? [],
      documents: documentsQ.data ?? [],
    };
  }, [account, vehiclesQ.data, recordsQ.data, remindersQ.data, documentsQ.data, vehicleId]);

  const loading = vehiclesQ.isLoading || recordsQ.isLoading;
  const offline = !!(recordsQ.error && (recordsQ.error as Error).name === 'NetworkError');
  return { ctx, loading, offline, garage };
}
