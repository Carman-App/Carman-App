import { usePathname } from 'expo-router';
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { clearProgress, isResumableStep, loadProgress, saveProgress } from '@/features/onboarding/progress';
import { getUiState } from '@/data/uiState';

import type { AccountProfile, Powertrain, Region, Transmission, VehicleType, VehicleUsage } from '@/types/domain';

export type OnboardingDraft = {
  name: string;
  email: string;
  region: Region;
  /** Unset until chosen: the design never picks for the person. */
  profile?: AccountProfile;
  garageName: string;
  garageLocation: string;
  vehicleType?: VehicleType;
  usage?: VehicleUsage;
  make: string;
  model: string;
  variant: string;
  year?: number;
  powertrain?: Powertrain;
  transmission?: Transmission;
  vin: string;
  odometerKm: number;
  /** The odometer's unit on the first-reading screen (SWITCH KM / MI); saved in km. */
  unit: 'km' | 'mi';
  vehicleId?: string;
  businessName: string;
  businessTown: string;
  teamSize?: 'solo' | 'helper' | 'team';
  /** The workshop this set-up created, so going Back and on again updates it. */
  workshopId?: string;
};

const DEFAULT_DRAFT: OnboardingDraft = {
  name: '',
  email: '',
  region: 'KE',
  profile: undefined,
  garageName: '',
  garageLocation: '',
  vehicleType: undefined,
  usage: undefined,
  make: '',
  model: '',
  variant: '',
  year: undefined,
  powertrain: undefined,
  transmission: undefined,
  vin: '',
  odometerKm: 0,
  unit: 'km',
  vehicleId: undefined,
  businessName: '',
  businessTown: '',
  teamSize: undefined,
};

type OnboardingContextValue = {
  draft: OnboardingDraft;
  update: (patch: Partial<OnboardingDraft>) => void;
};

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [draft, setDraft] = useState<OnboardingDraft>(DEFAULT_DRAFT);
  const [loaded, setLoaded] = useState(false);
  const pathname = usePathname();
  const lastStep = useRef<string | null>(null);

  // Restore unfinished set-up answers (see ./progress.ts).
  useEffect(() => {
    void (async () => {
      if (getUiState().onboarded) await clearProgress();
      else {
        const p = await loadProgress();
        if (p) {
          setDraft({ ...DEFAULT_DRAFT, ...p.draft });
          lastStep.current = p.step;
        }
      }
      setLoaded(true);
    })();
  }, []);

  // Save the answers and the current step as they change.
  useEffect(() => {
    if (!loaded || getUiState().onboarded) return;
    if (isResumableStep(pathname)) lastStep.current = pathname;
    if (lastStep.current) void saveProgress({ step: lastStep.current, draft });
  }, [loaded, pathname, draft]);

  const value = useMemo(
    () => ({
      draft,
      update: (patch: Partial<OnboardingDraft>) => setDraft((d) => ({ ...d, ...patch })),
    }),
    [draft]
  );
  // Screens read the draft in their initial state, so wait for the restore.
  if (!loaded) return null;
  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}

export function useOnboardingDraft() {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error('useOnboardingDraft must be used within OnboardingProvider');
  return ctx;
}
