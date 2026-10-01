/**
 * Raw JSON shapes returned by admin/'s /api/v1/* routes this app reads.
 * Money arrives as fixed two-decimal strings (Decimal(12,2)), dates as full
 * ISO timestamps. See admin/src/lib/reports/report-data.ts for the source.
 */

export type RawConventions = {
  region: string
  countryName: string | null
  currencyCode: string
  currencySymbol: string | null
  currencySymbolPlacement: 'BEFORE' | 'AFTER'
  distanceUnit: 'KM' | 'MI'
  volumeUnit: 'LITRE' | 'GALLON'
  dateFormat: string
  source: 'country_config' | 'region_default'
}

export type RawAccountSummary = { id: string; name: string; region: string }

export type RawRecordType = 'fuel' | 'service' | 'repair' | 'expense' | 'odometer'

export type RawGarageReportData = {
  generatedAt: string
  account: RawAccountSummary
  conventions: RawConventions
  garage: { id: string; name: string; location: string; ownerId: string; createdAt: string | null }
  members: {
    id: string
    accountId: string
    displayName: string
    role: 'OWNER' | 'MEMBER'
    joinedAt: string | null
    removedAt: string | null
  }[]
  vehicles: {
    id: string
    make: string
    model: string
    year: number
    type: 'CAR' | 'MOTORCYCLE'
    usage: string
    plate: string
    odometerKm: number
    powertrain: string | null
    nextServiceDueKm: number | null
    createdAt: string | null
  }[]
  records: {
    id: string
    vehicleId: string
    type: RawRecordType
    date: string | null
    amount: string | null
    litres: string | null
    odometerKm: number
    category: string | null
    description: string | null
    place: string | null
    notes: string | null
    enteredByAccountId: string | null
    enteredByName: string
    createdAt: string | null
    editedAt: string | null
  }[]
  deletedRecords: {
    id: string
    vehicleId: string
    type: RawRecordType
    date: string | null
    amount: string | null
    deletedAt: string | null
  }[]
  reminders: {
    id: string
    vehicleId: string
    kind: string
    dueDate: string | null
    dueKm: number | null
    description: string
  }[]
  documents: {
    id: string
    vehicleId: string
    typeCode: string
    typeLabel: string
    title: string
    expiryDate: string | null
    addedAt: string | null
  }[]
  projects: {
    id: string
    vehicleId: string
    name: string | null
    budget: string | null
    spent: string | null
    createdAt: string | null
    stages: {
      id: string
      name: string
      status: 'NOT_STARTED' | 'IN_PROGRESS' | 'DONE'
      createdAt: string | null
      modifications: { id: string; name: string; cost: string | null }[]
      parts: { id: string; name: string; cost: string | null; supplier: string | null; date: string | null; createdAt: string | null }[]
    }[]
  }[]
  serviceIntervals: {
    code: string
    label: string
    vehicleClass: string | null
    intervalKm: number | null
    intervalMonths: number | null
  }[]
}

export type RawJobStatus =
  | 'INTAKE'
  | 'AWAITING_APPROVAL'
  | 'APPROVED'
  | 'IN_PROGRESS'
  | 'READY_FOR_COLLECTION'
  | 'INVOICED'
  | 'PARTIALLY_PAID'
  | 'PAID'
  | 'DECLINED'
  | 'CANCELLED'

export type RawWorkshopReportData = {
  generatedAt: string
  account: RawAccountSummary
  conventions: RawConventions
  workshop: { id: string; name: string; createdAt: string | null }
  members: { id: string; accountId: string; displayName: string; role: string; joinedAt: string | null }[]
  customers: { id: string; name: string; phone: string | null; createdAt: string | null }[]
  jobs: {
    id: string
    customerId: string
    vehicleId: string | null
    vehicle: { make: string; model: string; plate: string } | null
    vehicleDescription: string | null
    faultDescription: string
    status: RawJobStatus
    createdAt: string | null
    updatedAt: string | null
    lines: { id: string; kind: string; description: string; cost: string | null }[]
    assignments: { workshopMemberId: string; assignedAt: string | null }[]
    statusEvents: { fromStatus: RawJobStatus | null; toStatus: RawJobStatus; changedAt: string | null }[]
  }[]
  estimates: {
    id: string
    jobId: string
    vehicleId: string
    status: 'PENDING' | 'APPROVED' | 'DECLINED'
    total: string | null
    createdAt: string | null
    items: { id: string; description: string; cost: string | null }[]
    decisions: { decision: 'APPROVED' | 'DECLINED'; decidedAt: string | null }[]
  }[]
  invoices: {
    id: string
    jobId: string
    estimateId: string | null
    vehicleId: string
    status: 'UNPAID' | 'PARTIALLY_PAID' | 'PAID'
    total: string | null
    dueDate: string | null
    createdAt: string | null
    items: { id: string; description: string; cost: string | null }[]
    payments: { id: string; amount: string | null; method: string; paidAt: string | null }[]
  }[]
}

export type RawGarage = { id: string; ownerId: string; name: string; location: string }

export type RawWorkshop = { id: string; ownerId: string; name: string }

export type RawAccount = {
  id: string
  region: string
  user: { name: string; email: string }
  profiles: { type: 'OWNER' | 'MECHANIC'; isActive: boolean }[]
}
