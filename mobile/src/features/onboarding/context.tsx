import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

import type { AccountProfile, Powertrain, Region, VehicleType, VehicleUsage } from '@/types/domain';

export type OnboardingDraft = {
  name: string;
  email: string;
  region: Region;
  profile: AccountProfile;
  garageName: string;
  garageLocation: string;
  vehicleType: VehicleType;
  usage: VehicleUsage;
  make: string;
  model: string;
  variant: string;
  year: number;
  powertrain?: Powertrain;
  odometerKm: number;
  vehicleId?: string;
};

const DEFAULT_DRAFT: OnboardingDraft = {
  name: 'Wallace Ralak',
  email: 'wallaceralak@gmail.com',
  region: 'KE',
  profile: 'owner',
  garageName: 'My Garage',
  garageLocation: 'Nairobi',
  vehicleType: 'car',
  usage: 'daily',
  make: 'Toyota',
  model: 'Land Cruiser Prado',
  variant: '',
  year: 2018,
  powertrain: undefined,
  odometerKm: 0,
  vehicleId: undefined,
};

type OnboardingContextValue = {
  draft: OnboardingDraft;
  update: (patch: Partial<OnboardingDraft>) => void;
};

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [draft, setDraft] = useState<OnboardingDraft>(DEFAULT_DRAFT);
  const value = useMemo(
    () => ({
      draft,
      update: (patch: Partial<OnboardingDraft>) => setDraft((d) => ({ ...d, ...patch })),
    }),
    [draft]
  );
  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}

export function useOnboardingDraft() {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error('useOnboardingDraft must be used within OnboardingProvider');
  return ctx;
}
