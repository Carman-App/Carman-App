/**
 * Carma domain types — Owner-side product.
 *
 * These are the shapes the mock data layer (`src/data/*`) returns. Keep them
 * backend-agnostic: no client-only fields, no React types. When a real API
 * lands, these types (or a thin transform over them) should still hold.
 */

// Full list of countries offered on the COUNTRY onboarding screen, matching the
// prototype's ~66-country list exactly (Kenya first and kept as the sensible
// default — all seed/demo data assumes Kenya).
export type Region =
  | 'KE' | 'UG' | 'TZ' | 'RW' | 'ET' | 'SO' | 'SS' | 'BI' | 'CD'
  | 'ZA' | 'ZM' | 'ZW' | 'BW' | 'NA' | 'MZ' | 'MW' | 'AO' | 'MU'
  | 'NG' | 'GH' | 'CI' | 'SN' | 'CM' | 'EG' | 'MA' | 'TN'
  | 'GB' | 'IE' | 'DE' | 'FR' | 'ES' | 'IT' | 'NL' | 'PT' | 'PL' | 'SE' | 'NO' | 'CH' | 'TR'
  | 'US' | 'CA' | 'MX' | 'BR' | 'AR' | 'CL' | 'CO'
  | 'AE' | 'SA' | 'QA' | 'OM' | 'IL'
  | 'IN' | 'PK' | 'LK' | 'BD' | 'CN' | 'JP' | 'KR' | 'MY' | 'SG' | 'ID' | 'TH' | 'PH' | 'VN'
  | 'AU' | 'NZ';

export type UnitSystem = {
  currency: string; // e.g. "KES"
  distance: 'km' | 'mi';
  volume: 'L' | 'gal';
};

export const REGION_UNITS: Record<Region, UnitSystem> = {
  KE: { currency: 'KES', distance: 'km', volume: 'L' },
  UG: { currency: 'UGX', distance: 'km', volume: 'L' },
  TZ: { currency: 'TZS', distance: 'km', volume: 'L' },
  RW: { currency: 'RWF', distance: 'km', volume: 'L' },
  ET: { currency: 'ETB', distance: 'km', volume: 'L' },
  SO: { currency: 'SOS', distance: 'km', volume: 'L' },
  SS: { currency: 'SSP', distance: 'km', volume: 'L' },
  BI: { currency: 'BIF', distance: 'km', volume: 'L' },
  CD: { currency: 'CDF', distance: 'km', volume: 'L' },
  ZA: { currency: 'ZAR', distance: 'km', volume: 'L' },
  ZM: { currency: 'ZMW', distance: 'km', volume: 'L' },
  ZW: { currency: 'USD', distance: 'km', volume: 'L' },
  BW: { currency: 'BWP', distance: 'km', volume: 'L' },
  NA: { currency: 'NAD', distance: 'km', volume: 'L' },
  MZ: { currency: 'MZN', distance: 'km', volume: 'L' },
  MW: { currency: 'MWK', distance: 'km', volume: 'L' },
  AO: { currency: 'AOA', distance: 'km', volume: 'L' },
  MU: { currency: 'MUR', distance: 'km', volume: 'L' },
  NG: { currency: 'NGN', distance: 'km', volume: 'L' },
  GH: { currency: 'GHS', distance: 'km', volume: 'L' },
  CI: { currency: 'XOF', distance: 'km', volume: 'L' },
  SN: { currency: 'XOF', distance: 'km', volume: 'L' },
  CM: { currency: 'XAF', distance: 'km', volume: 'L' },
  EG: { currency: 'EGP', distance: 'km', volume: 'L' },
  MA: { currency: 'MAD', distance: 'km', volume: 'L' },
  TN: { currency: 'TND', distance: 'km', volume: 'L' },
  GB: { currency: 'GBP', distance: 'mi', volume: 'L' },
  IE: { currency: 'EUR', distance: 'km', volume: 'L' },
  DE: { currency: 'EUR', distance: 'km', volume: 'L' },
  FR: { currency: 'EUR', distance: 'km', volume: 'L' },
  ES: { currency: 'EUR', distance: 'km', volume: 'L' },
  IT: { currency: 'EUR', distance: 'km', volume: 'L' },
  NL: { currency: 'EUR', distance: 'km', volume: 'L' },
  PT: { currency: 'EUR', distance: 'km', volume: 'L' },
  PL: { currency: 'PLN', distance: 'km', volume: 'L' },
  SE: { currency: 'SEK', distance: 'km', volume: 'L' },
  NO: { currency: 'NOK', distance: 'km', volume: 'L' },
  CH: { currency: 'CHF', distance: 'km', volume: 'L' },
  TR: { currency: 'TRY', distance: 'km', volume: 'L' },
  US: { currency: 'USD', distance: 'mi', volume: 'gal' },
  CA: { currency: 'CAD', distance: 'km', volume: 'L' },
  MX: { currency: 'MXN', distance: 'km', volume: 'L' },
  BR: { currency: 'BRL', distance: 'km', volume: 'L' },
  AR: { currency: 'ARS', distance: 'km', volume: 'L' },
  CL: { currency: 'CLP', distance: 'km', volume: 'L' },
  CO: { currency: 'COP', distance: 'km', volume: 'L' },
  AE: { currency: 'AED', distance: 'km', volume: 'L' },
  SA: { currency: 'SAR', distance: 'km', volume: 'L' },
  QA: { currency: 'QAR', distance: 'km', volume: 'L' },
  OM: { currency: 'OMR', distance: 'km', volume: 'L' },
  IL: { currency: 'ILS', distance: 'km', volume: 'L' },
  IN: { currency: 'INR', distance: 'km', volume: 'L' },
  PK: { currency: 'PKR', distance: 'km', volume: 'L' },
  LK: { currency: 'LKR', distance: 'km', volume: 'L' },
  BD: { currency: 'BDT', distance: 'km', volume: 'L' },
  CN: { currency: 'CNY', distance: 'km', volume: 'L' },
  JP: { currency: 'JPY', distance: 'km', volume: 'L' },
  KR: { currency: 'KRW', distance: 'km', volume: 'L' },
  MY: { currency: 'MYR', distance: 'km', volume: 'L' },
  SG: { currency: 'SGD', distance: 'km', volume: 'L' },
  ID: { currency: 'IDR', distance: 'km', volume: 'L' },
  TH: { currency: 'THB', distance: 'km', volume: 'L' },
  PH: { currency: 'PHP', distance: 'km', volume: 'L' },
  VN: { currency: 'VND', distance: 'km', volume: 'L' },
  AU: { currency: 'AUD', distance: 'km', volume: 'L' },
  NZ: { currency: 'NZD', distance: 'km', volume: 'L' },
};

export type AccountProfile = 'owner' | 'mechanic' | 'both';

export type Account = {
  id: string;
  name: string;
  email: string;
  region: Region;
  profile: AccountProfile;
  activeProfile: 'owner' | 'mechanic';
  plan: 'free' | 'personal' | 'pro';
  /** The owner-side plan in force, from GET /account. Null when the server has no plans set up. */
  planState: PlanState | null;
  /** The workshop's plan when this account runs a workshop. */
  workshopPlanState: PlanState | null;
  /** Which kinds of notification are pushed (My profile → Notifications). Missing key = default. */
  notificationPrefs: Record<string, boolean>;
};

export type PlanLimits = { garages: number | null; vehicles: number | null; seats: number | null; jobsPerMonth?: number | null; staff?: number | null };

export type PlanState = {
  code: string;
  name: string;
  /** trial: no-card trial · active: paid · grace: payment failed, inside grace · free: no paid plan */
  state: 'trial' | 'active' | 'grace' | 'free';
  trialEndsAt: string | null;
  limits: PlanLimits;
  /** APP_STORE / PLAY_STORE when bought in the app; null for trials and plans set by Carma. */
  store?: string | null;
  storeProductId?: string | null;
  /** False once auto-renew is off: the plan ends at currentPeriodEnd. */
  willRenew?: boolean | null;
  currentPeriodEnd?: string | null;
};

export type PlanOption = {
  code: string;
  name: string;
  features: string[];
  limits: PlanLimits;
  price: { currency: string; amountCents: number } | null;
  /** In-app purchase products that buy this plan. Empty = not sold in the app. */
  storeProductIds?: string[];
};

export type GarageMemberRole = 'owner' | 'member' | 'pending';

export type GarageMember = {
  id: string;
  garageId: string;
  name: string;
  role: GarageMemberRole;
  email?: string;
  joinedAt?: string;
};

export type Garage = {
  id: string;
  name: string;
  location: string;
  ownerId: string;
  memberIds: string[];
};

export type VehicleType = 'car' | 'motorcycle';

export type VehicleUsage = 'daily' | 'project' | 'weekend' | 'commercial';

export const USAGE_LABEL: Record<VehicleUsage, string> = {
  daily: 'DAILY DRIVER',
  project: 'PROJECT VEHICLE',
  weekend: 'WEEKEND',
  commercial: 'COMMERCIAL',
};

export type Powertrain = 'petrol' | 'diesel' | 'hybrid' | 'electric' | 'plug-in-hybrid' | 'other';

export type Transmission = 'manual' | 'automatic' | 'semi-auto';

export type Vehicle = {
  id: string;
  garageId: string;
  make: string;
  model: string;
  /** Trim/variant, e.g. "TX-L". Optional — collected at onboarding but not required (prototype screen 07). */
  variant?: string;
  year: number;
  type: VehicleType;
  usage: VehicleUsage;
  /** Registration/number plate. Not collected during onboarding (prototype screen 07 has no plate field) — added later from Vehicle Details. */
  plate?: string;
  odometerKm: number;
  photo?: string;
  vin?: string;
  powertrain?: Powertrain;
  transmission?: Transmission;
  nextServiceDueKm?: number;
  color?: string;
  /** ISO date the vehicle was added to Carma. Set once, at creation, in completeOnboarding/addVehicle. */
  createdAt: string;
};

export type RecordType = 'fuel' | 'service' | 'repair' | 'part' | 'expense' | 'odometer';

export type VehicleRecord = {
  id: string;
  vehicleId: string;
  type: RecordType;
  date: string; // ISO date
  amount: number;
  odometerAtEntry: number;
  place?: string;
  enteredByMemberName: string;
  notes?: string;
  litres?: number;
  category?: 'fuel' | 'service' | 'insurance' | 'loan' | 'other';
};

export type DocumentType = 'insurance' | 'logbook' | 'inspection' | 'invoice' | 'receipt';

export type VehicleDocument = {
  id: string;
  vehicleId: string;
  type: DocumentType;
  title: string;
  expiryDate?: string;
  fileRef?: string;
  addedAt: string;
};

export type ReminderKind = 'service-due' | 'document-expiry' | 'estimate-pending' | 'project-stalled';

export type Reminder = {
  id: string;
  vehicleId: string;
  kind: ReminderKind;
  dueDate?: string;
  dueKm?: number;
  description: string;
  resolved?: boolean;
};

export type BuildStageStatus = 'not-started' | 'in-progress' | 'done';

export type ModificationArea = 'suspension' | 'engine' | 'brakes' | 'wheels' | 'exterior' | 'interior' | 'electrics' | 'drivetrain';

export type Modification = {
  id: string;
  stageId: string;
  name: string;
  cost: number;
  area?: ModificationArea;
  date?: string;
};

export type PartStatus = 'on-order' | 'in-storage' | 'fitted';

export type PartLine = {
  id: string;
  stageId: string;
  name: string;
  cost: number;
  supplier?: string;
  brand?: string;
  partNumber?: string;
  quantity?: number;
  status?: PartStatus;
  date?: string;
};

export type BuildStage = {
  id: string;
  projectId: string;
  name: string;
  status: BuildStageStatus;
  modificationIds: string[];
  partIds: string[];
  /** Planned spend for this stage, set from the Build Brief. Optional — older/seed stages may not have one. */
  estimate?: number;
};

export type BuildBriefType = 'driver' | 'restomod' | 'concours' | 'frame-off';

export type ProjectBuild = {
  id: string;
  vehicleId: string;
  budget: number;
  spent: number;
  stages: BuildStage[];
  briefType?: BuildBriefType;
  contingencyPct?: number;
};

export type ReportScope = 'vehicle' | 'garage';

export type Report = {
  id: string;
  scope: ReportScope;
  scopeId: string;
  periodLabel: string;
  generatedAt: string;
};

export type EstimateStatus = 'pending' | 'approved' | 'declined';

export type EstimateLine = { id: string; description: string; cost: number };

export type Estimate = {
  id: string;
  vehicleId: string;
  workshopName: string;
  status: EstimateStatus;
  lines: EstimateLine[];
  total: number;
  createdAt: string;
  notes?: string;
};

export type InvoiceStatus = 'unpaid' | 'paid';

export type Invoice = {
  id: string;
  vehicleId: string;
  workshopName: string;
  status: InvoiceStatus;
  lines: EstimateLine[];
  total: number;
  dueDate?: string;
  createdAt: string;
};

export type InspectionReport = {
  id: string;
  vehicleId: string;
  workshopName: string;
  createdAt: string;
  summary: string;
  items: { id: string; label: string; status: 'good' | 'attention' | 'urgent'; note?: string }[];
};

export type AccessRequestStatus = 'pending' | 'approved' | 'denied';

export type AccessRequest = {
  id: string;
  vehicleId: string;
  workshopName: string;
  status: AccessRequestStatus;
  requestedAt: string;
  scope: string;
};
