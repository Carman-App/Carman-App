/**
 * Central query-key factory. Every hook in `@/data/hooks` and every
 * invalidation call in `@/data/repo` goes through this so the two stay in
 * sync — a key typo here would silently break cache invalidation after a
 * mutation.
 */
export const qk = {
  account: () => ['account'] as const,

  garages: () => ['garages'] as const,
  garage: (garageId: string | undefined) => ['garage', garageId] as const,
  garageMembers: (garageId: string | undefined) => ['garageMembers', garageId] as const,
  garageReminders: (garageId: string | undefined) => ['garageReminders', garageId] as const,
  garageRecords: (garageId: string | undefined) => ['garageRecords', garageId] as const,
  garageDocuments: (garageId: string | undefined) => ['garageDocuments', garageId] as const,

  vehicles: (garageId: string | undefined) => ['vehicles', garageId] as const,
  vehicle: (vehicleId: string | undefined) => ['vehicle', vehicleId] as const,

  records: (vehicleId: string | undefined) => ['records', vehicleId] as const,
  documents: (vehicleId: string | undefined) => ['documents', vehicleId] as const,
  reminders: (vehicleId: string | undefined) => ['reminders', vehicleId] as const,
  timeline: (vehicleId: string | undefined) => ['timeline', vehicleId] as const,
  insights: (vehicleId: string | undefined) => ['insights', vehicleId] as const,

  projects: (vehicleId: string | undefined) => ['projects', vehicleId] as const,
  project: (projectId: string | undefined) => ['project', projectId] as const,
  // No GET-by-id endpoint exists for a project stage/modification/part list —
  // these are seeded into the cache as a side effect of fetching a project
  // (see @/data/api/aggregates's seedStageCaches) rather than fetched directly.
  buildStage: (stageId: string | undefined) => ['buildStage', stageId] as const,
  stageModifications: (stageId: string | undefined) => ['stageModifications', stageId] as const,
  stageParts: (stageId: string | undefined) => ['stageParts', stageId] as const,

  estimates: (vehicleId: string | undefined) => ['estimates', vehicleId] as const,
  estimate: (estimateId: string | undefined) => ['estimate', estimateId] as const,

  invoices: (vehicleId: string | undefined) => ['invoices', vehicleId] as const,
  invoice: (invoiceId: string | undefined) => ['invoice', invoiceId] as const,

  inspections: (vehicleId: string | undefined) => ['inspections', vehicleId] as const,
  inspection: (inspectionId: string | undefined) => ['inspection', inspectionId] as const,

  accessRequests: (vehicleId: string | undefined) => ['accessRequests', vehicleId] as const,

  notifications: () => ['notifications'] as const,
};
