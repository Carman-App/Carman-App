import type {
  Account,
  AccessRequest,
  BuildStage,
  Estimate,
  Garage,
  GarageMember,
  Invoice,
  InspectionReport,
  ProjectBuild,
  Reminder,
  Vehicle,
  VehicleDocument,
  VehicleRecord,
} from '@/types/domain';

export const SEED_ACCOUNT: Account = {
  id: 'acc-1',
  name: 'Wallace Ralak',
  email: 'wallaceralak@gmail.com',
  region: 'KE',
  profile: 'owner',
  activeProfile: 'owner',
  plan: 'free',
  planState: null,
  workshopPlanState: null,
  notificationPrefs: {},
};

export const SEED_GARAGES: Garage[] = [
  {
    id: 'garage-1',
    name: 'My Garage',
    location: 'Ngong Road, Nairobi',
    ownerId: 'acc-1',
    memberIds: ['mem-1', 'mem-2', 'mem-3'],
  },
];

export const SEED_MEMBERS: GarageMember[] = [
  { id: 'mem-1', garageId: 'garage-1', name: 'Wallace R', role: 'owner', email: 'wallaceralak@gmail.com', joinedAt: '2024-01-12' },
  { id: 'mem-2', garageId: 'garage-1', name: 'George M', role: 'member', email: 'george.m@gmail.com', joinedAt: '2024-03-02' },
  { id: 'mem-3', garageId: 'garage-1', name: 'Diana K', role: 'pending', email: 'diana.k@gmail.com' },
];

export const SEED_VEHICLES: Vehicle[] = [
  {
    id: 'veh-prado',
    garageId: 'garage-1',
    make: 'Toyota',
    model: 'Land Cruiser Prado',
    variant: 'TX-L',
    year: 2018,
    type: 'car',
    usage: 'daily',
    plate: 'KDG 441X',
    odometerKm: 84520,
    vin: undefined,
    powertrain: 'diesel',
    nextServiceDueKm: 90000,
    color: '#1F4FD8',
    createdAt: '2019-03-14',
  },
  {
    id: 'veh-e36',
    garageId: 'garage-1',
    make: 'BMW',
    model: 'E36 328i',
    year: 1994,
    type: 'car',
    usage: 'project',
    plate: 'KAJ 902B',
    odometerKm: 211300,
    vin: 'WBACB61070EM',
    powertrain: 'petrol',
    color: '#C4432E',
    createdAt: '2024-11-02',
  },
  {
    id: 'veh-tenere',
    garageId: 'garage-1',
    make: 'Yamaha',
    model: 'XT660Z Ténéré',
    year: 2015,
    type: 'motorcycle',
    usage: 'weekend',
    plate: 'KMDE 771',
    odometerKm: 42800,
    powertrain: 'petrol',
    nextServiceDueKm: 45000,
    color: '#1E8A5F',
    createdAt: '2025-06-20',
  },
];

// 24 records this month for the Garage/Timeline screens, spanning the three
// vehicles, weighted so the category split lands close to
// Fuel 24% · Service 14% · Insurance 8% · Loan 41% · Other 13% (KES 482,450 total).
export const SEED_RECORDS: VehicleRecord[] = [
  { id: 'rec-1', vehicleId: 'veh-prado', type: 'fuel', date: '2026-08-03', amount: 7400, odometerAtEntry: 84520, place: 'Shell Ngong Road', enteredByMemberName: 'George M', litres: 46.2, category: 'fuel' },
  { id: 'rec-2', vehicleId: 'veh-e36', type: 'expense', date: '2026-08-02', amount: 198000, odometerAtEntry: 211300, place: 'CBA Loan', enteredByMemberName: 'Wallace R', notes: 'Monthly loan instalment', category: 'loan' },
  { id: 'rec-3', vehicleId: 'veh-tenere', type: 'fuel', date: '2026-08-01', amount: 2100, odometerAtEntry: 42800, place: 'TotalEnergies Karen', enteredByMemberName: 'Wallace R', litres: 13.5, category: 'fuel' },
  { id: 'rec-4', vehicleId: 'veh-prado', type: 'service', date: '2026-07-29', amount: 18500, odometerAtEntry: 84100, place: "Toyota Kenya - Uhuru Hwy", enteredByMemberName: 'Wallace R', notes: 'Oil + filters, brake inspection', category: 'service' },
  { id: 'rec-5', vehicleId: 'veh-e36', type: 'part', date: '2026-07-26', amount: 34500, odometerAtEntry: 211200, place: 'GermanCarParts Nairobi', enteredByMemberName: 'Wallace R', notes: 'Coilover set', category: 'other' },
  { id: 'rec-6', vehicleId: 'veh-prado', type: 'expense', date: '2026-07-24', amount: 12800, odometerAtEntry: 84050, place: 'Jubilee Insurance', enteredByMemberName: 'Wallace R', notes: 'Comprehensive premium instalment', category: 'insurance' },
  { id: 'rec-7', vehicleId: 'veh-prado', type: 'fuel', date: '2026-07-22', amount: 6900, odometerAtEntry: 83980, place: 'Shell Ngong Road', enteredByMemberName: 'George M', litres: 43.1, category: 'fuel' },
  { id: 'rec-8', vehicleId: 'veh-tenere', type: 'repair', date: '2026-07-20', amount: 4200, odometerAtEntry: 42600, place: "Rift Valley Motorcycles", enteredByMemberName: 'Wallace R', notes: 'Chain and sprocket set', category: 'other' },
  { id: 'rec-9', vehicleId: 'veh-e36', type: 'expense', date: '2026-07-18', amount: 198000, odometerAtEntry: 210900, place: 'CBA Loan', enteredByMemberName: 'Wallace R', notes: 'Monthly loan instalment', category: 'loan' },
  { id: 'rec-10', vehicleId: 'veh-prado', type: 'fuel', date: '2026-07-15', amount: 7100, odometerAtEntry: 83600, place: 'Shell Langata', enteredByMemberName: 'George M', litres: 44.4, category: 'fuel' },
  { id: 'rec-11', vehicleId: 'veh-tenere', type: 'expense', date: '2026-07-14', amount: 5600, odometerAtEntry: 42400, place: 'AAR Insurance', enteredByMemberName: 'Wallace R', notes: 'Third party premium', category: 'insurance' },
  { id: 'rec-12', vehicleId: 'veh-prado', type: 'odometer', date: '2026-07-12', amount: 0, odometerAtEntry: 83500, enteredByMemberName: 'George M', notes: 'Odometer roll', category: 'other' },
  { id: 'rec-13', vehicleId: 'veh-e36', type: 'part', date: '2026-07-10', amount: 21000, odometerAtEntry: 210500, place: 'GermanCarParts Nairobi', enteredByMemberName: 'Wallace R', notes: 'Exhaust manifold gasket kit', category: 'other' },
  { id: 'rec-14', vehicleId: 'veh-prado', type: 'fuel', date: '2026-07-08', amount: 7250, odometerAtEntry: 83100, place: 'Shell Ngong Road', enteredByMemberName: 'Diana K', litres: 45.3, category: 'fuel' },
  { id: 'rec-15', vehicleId: 'veh-tenere', type: 'fuel', date: '2026-07-06', amount: 1980, odometerAtEntry: 42100, place: 'TotalEnergies Karen', enteredByMemberName: 'Wallace R', litres: 12.7, category: 'fuel' },
  { id: 'rec-16', vehicleId: 'veh-e36', type: 'expense', date: '2026-07-04', amount: 198000, odometerAtEntry: 210100, place: 'CBA Loan', enteredByMemberName: 'Wallace R', notes: 'Monthly loan instalment', category: 'loan' },
  { id: 'rec-17', vehicleId: 'veh-prado', type: 'expense', date: '2026-07-02', amount: 3200, odometerAtEntry: 82800, place: 'Nairobi County', enteredByMemberName: 'Wallace R', notes: 'Parking + toll', category: 'other' },
  { id: 'rec-18', vehicleId: 'veh-tenere', type: 'service', date: '2026-06-29', amount: 6400, odometerAtEntry: 41900, place: 'Rift Valley Motorcycles', enteredByMemberName: 'Wallace R', notes: 'Valve clearance check', category: 'service' },
  { id: 'rec-19', vehicleId: 'veh-prado', type: 'fuel', date: '2026-06-26', amount: 7050, odometerAtEntry: 82400, place: 'Shell Langata', enteredByMemberName: 'George M', litres: 44.1, category: 'fuel' },
  { id: 'rec-20', vehicleId: 'veh-e36', type: 'repair', date: '2026-06-24', amount: 15800, odometerAtEntry: 209600, place: "Bimmer Specialists Ltd", enteredByMemberName: 'Wallace R', notes: 'Cooling system overhaul', category: 'other' },
  { id: 'rec-21', vehicleId: 'veh-prado', type: 'service', date: '2026-06-20', amount: 9600, odometerAtEntry: 82000, place: "Toyota Kenya - Uhuru Hwy", enteredByMemberName: 'Wallace R', notes: 'Tyre rotation + alignment', category: 'service' },
  { id: 'rec-22', vehicleId: 'veh-tenere', type: 'fuel', date: '2026-06-18', amount: 2050, odometerAtEntry: 41500, place: 'TotalEnergies Karen', enteredByMemberName: 'Wallace R', litres: 13.1, category: 'fuel' },
  { id: 'rec-23', vehicleId: 'veh-prado', type: 'fuel', date: '2026-06-15', amount: 6800, odometerAtEntry: 81600, place: 'Shell Ngong Road', enteredByMemberName: 'George M', litres: 42.5, category: 'fuel' },
  { id: 'rec-24', vehicleId: 'veh-e36', type: 'expense', date: '2026-06-12', amount: 198000, odometerAtEntry: 208900, place: 'CBA Loan', enteredByMemberName: 'Wallace R', notes: 'Monthly loan instalment', category: 'loan' },
];

export const SEED_DOCUMENTS: VehicleDocument[] = [
  { id: 'doc-1', vehicleId: 'veh-prado', type: 'insurance', title: 'Jubilee Comprehensive Cover', expiryDate: '2026-11-02', addedAt: '2025-11-02' },
  { id: 'doc-2', vehicleId: 'veh-prado', type: 'logbook', title: 'KRA Logbook', addedAt: '2018-05-14' },
  { id: 'doc-3', vehicleId: 'veh-prado', type: 'inspection', title: 'NTSA Inspection Certificate', expiryDate: '2026-09-30', addedAt: '2025-09-30' },
  { id: 'doc-4', vehicleId: 'veh-e36', type: 'logbook', title: 'KRA Logbook', addedAt: '1994-08-01' },
  { id: 'doc-5', vehicleId: 'veh-e36', type: 'receipt', title: 'Coilover Set Receipt', addedAt: '2026-07-26' },
  { id: 'doc-6', vehicleId: 'veh-tenere', type: 'insurance', title: 'AAR Third Party Cover', expiryDate: '2026-09-14', addedAt: '2025-09-14' },
];

export const SEED_REMINDERS: Reminder[] = [
  { id: 'rem-1', vehicleId: 'veh-prado', kind: 'service-due', dueKm: 90000, description: 'Full service due in 5,480 km' },
  { id: 'rem-2', vehicleId: 'veh-tenere', kind: 'service-due', dueKm: 45000, description: 'Valve service due in 2,200 km' },
  { id: 'rem-3', vehicleId: 'veh-prado', kind: 'document-expiry', dueDate: '2026-09-30', description: 'NTSA inspection certificate expires in 36 days' },
  { id: 'rem-4', vehicleId: 'veh-tenere', kind: 'document-expiry', dueDate: '2026-09-14', description: 'AAR third-party cover expires in 20 days' },
  { id: 'rem-5', vehicleId: 'veh-e36', kind: 'project-stalled', description: 'Suspension stage has had no activity in 18 days' },
  { id: 'rem-6', vehicleId: 'veh-e36', kind: 'estimate-pending', description: 'Bimmer Specialists Ltd estimate awaiting your approval' },
];

export const SEED_PROJECT: ProjectBuild = {
  id: 'proj-e36',
  vehicleId: 'veh-e36',
  budget: 2040000,
  spent: 1480000,
  briefType: 'restomod',
  contingencyPct: 20,
  stages: [
    { id: 'stage-1', projectId: 'proj-e36', name: 'Strip and assess', status: 'done', modificationIds: [], partIds: [], estimate: 60000 },
    { id: 'stage-2', projectId: 'proj-e36', name: 'Bodywork and rust', status: 'done', modificationIds: [], partIds: ['part-1'], estimate: 380000 },
    { id: 'stage-3', projectId: 'proj-e36', name: 'Paint', status: 'done', modificationIds: [], partIds: [], estimate: 400000 },
    { id: 'stage-4', projectId: 'proj-e36', name: 'Engine rebuild', status: 'done', modificationIds: ['mod-1'], partIds: [], estimate: 300000 },
    { id: 'stage-5', projectId: 'proj-e36', name: 'Suspension and brakes', status: 'done', modificationIds: ['mod-2'], partIds: ['part-2', 'part-3'], estimate: 180000 },
    { id: 'stage-6', projectId: 'proj-e36', name: 'Interior', status: 'in-progress', modificationIds: [], partIds: [], estimate: 220000 },
    { id: 'stage-7', projectId: 'proj-e36', name: 'Electrics and loom', status: 'not-started', modificationIds: [], partIds: [], estimate: 140000 },
    { id: 'stage-8', projectId: 'proj-e36', name: 'Shakedown and tune', status: 'not-started', modificationIds: [], partIds: [], estimate: 100000 },
    { id: 'stage-9', projectId: 'proj-e36', name: 'Modern running gear', status: 'not-started', modificationIds: [], partIds: [], estimate: 260000 },
  ],
};

export const SEED_BUILD_STAGES: BuildStage[] = SEED_PROJECT.stages;

export const SEED_MODIFICATIONS = [
  { id: 'mod-1', stageId: 'stage-4', name: 'Aluminium radiator + fan shroud', cost: 68000, area: 'engine' as const, date: '2026-03-02' },
  { id: 'mod-2', stageId: 'stage-5', name: 'Bilstein B8 coilover conversion', cost: 145000, area: 'suspension' as const, date: '2026-07-18' },
];

export const SEED_PARTS = [
  { id: 'part-1', stageId: 'stage-2', name: 'Rear arches, cut and welded', cost: 512000, supplier: 'Kimathi Motors', status: 'fitted' as const, date: '2026-06-02' },
  { id: 'part-2', stageId: 'stage-5', name: 'Coilover set', cost: 145000, supplier: 'GermanCarParts Nairobi', status: 'fitted' as const, date: '2026-07-18' },
  { id: 'part-3', stageId: 'stage-5', name: 'Adjustable camber plates', cost: 39000, supplier: 'GermanCarParts Nairobi', status: 'fitted' as const, date: '2026-07-18' },
];

export const SEED_ESTIMATES: Estimate[] = [
  {
    id: 'est-1',
    vehicleId: 'veh-e36',
    workshopName: 'Bimmer Specialists Ltd',
    status: 'pending',
    lines: [
      { id: 'l1', description: 'Rear subframe bushings', cost: 24000 },
      { id: 'l2', description: 'Labour (4 hrs)', cost: 12000 },
    ],
    total: 36000,
    createdAt: '2026-08-10',
    notes: 'Recommend before next track day.',
  },
];

export const SEED_INVOICES: Invoice[] = [
  {
    id: 'inv-1',
    vehicleId: 'veh-prado',
    workshopName: 'Toyota Kenya - Uhuru Hwy',
    status: 'unpaid',
    lines: [
      { id: 'l1', description: 'Oil + filters', cost: 8500 },
      { id: 'l2', description: 'Brake inspection', cost: 4000 },
      { id: 'l3', description: 'Labour', cost: 6000 },
    ],
    total: 18500,
    dueDate: '2026-08-31',
    createdAt: '2026-07-29',
  },
];

export const SEED_INSPECTIONS: InspectionReport[] = [
  {
    id: 'insp-1',
    vehicleId: 'veh-prado',
    workshopName: 'Toyota Kenya - Uhuru Hwy',
    createdAt: '2026-07-29',
    summary: '18-point inspection — 2 items need attention before your next long trip.',
    items: [
      { id: 'i1', label: 'Brake pads (front)', status: 'attention', note: '30% remaining, replace within 3,000 km' },
      { id: 'i2', label: 'Battery health', status: 'good' },
      { id: 'i3', label: 'Tyre tread', status: 'good' },
      { id: 'i4', label: 'Coolant level', status: 'attention', note: 'Top up recommended' },
      { id: 'i5', label: 'Wiper blades', status: 'urgent', note: 'Replace immediately' },
    ],
  },
];

export const SEED_ACCESS_REQUESTS: AccessRequest[] = [
  {
    id: 'ar-1',
    vehicleId: 'veh-e36',
    workshopName: 'Bimmer Specialists Ltd',
    status: 'pending',
    requestedAt: '2026-08-20',
    scope: 'Full history + document access',
  },
];
