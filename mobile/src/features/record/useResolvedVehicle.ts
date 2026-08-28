import { useActiveGarageId, useVehicle, useVehicles } from '@/data/hooks';

/**
 * Every record-entry screen needs a vehicle. If a `vehicleId` param was
 * forwarded, use it; otherwise fall back to the active garage's first
 * vehicle so the flow never dead-ends waiting on a pick.
 *
 * Returns a plain `Vehicle | undefined` (not a query result) — same as
 * before the API migration — since every call site already treats
 * "no vehicle yet" (including "still loading") as one `if (!vehicle)` case.
 */
export function useResolvedVehicle(vehicleIdParam: string | undefined) {
  const garageId = useActiveGarageId();
  const garageVehiclesQuery = useVehicles(garageId ?? undefined);
  const paramVehicleQuery = useVehicle(vehicleIdParam);
  return paramVehicleQuery.data ?? garageVehiclesQuery.data?.[0];
}
