import { z } from "zod";
import {
  JobStatus,
  ExpenseCategory,
  GarageRole,
  VehicleType,
  VehicleUsage,
  Powertrain,
  BuildStageStatus,
  EstimateDecisionType,
  ReportScope,
  Region,
  ProfileType,
  JobLineKind,
} from "@/generated/prisma/enums";

function enumValues<T extends Record<string, string>>(e: T) {
  return Object.values(e) as [string, ...string[]];
}

export const createGarageSchema = z.object({
  name: z.string().trim().min(1).max(200),
  location: z.string().trim().min(1).max(200),
});

export const updateGarageSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    location: z.string().trim().min(1).max(200).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: "No fields to update." });

export const addGarageMemberSchema = z.object({
  accountId: z.string().min(1),
  role: z.enum(enumValues(GarageRole)).optional(),
  displayName: z.string().trim().min(1).max(200),
});

export const updateGarageMemberSchema = z
  .object({
    role: z.enum(enumValues(GarageRole)).optional(),
    displayName: z.string().trim().min(1).max(200).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: "No fields to update." });

export const createGarageInvitationSchema = z.object({
  email: z.email(),
  role: z.enum(enumValues(GarageRole)).optional(),
});

export const createVehicleSchema = z.object({
  garageId: z.string().min(1),
  make: z.string().trim().min(1).max(100),
  model: z.string().trim().min(1).max(100),
  year: z.number().int().min(1900).max(2100),
  type: z.enum(enumValues(VehicleType)).optional(),
  usage: z.enum(enumValues(VehicleUsage)).optional(),
  plate: z.string().trim().min(1).max(50),
  odometerKm: z.number().int().nonnegative().optional(),
  photo: z.string().trim().max(2000).optional(),
  vin: z.string().trim().max(50).optional(),
  powertrain: z.enum(enumValues(Powertrain)).optional(),
  nextServiceDueKm: z.number().int().nonnegative().optional(),
  color: z.string().trim().max(50).optional(),
});

export const updateVehicleSchema = createVehicleSchema
  .omit({ garageId: true })
  .partial()
  .refine((data) => Object.keys(data).length > 0, { message: "No fields to update." });

export const createRecordSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("fuel"),
    date: z.iso.datetime(),
    amount: z.number().positive(),
    odometerAtEntry: z.number().int().nonnegative(),
    litres: z.number().positive().optional(),
    place: z.string().trim().max(200).optional(),
    enteredByName: z.string().trim().min(1).max(200),
    notes: z.string().trim().max(2000).optional(),
  }),
  z.object({
    type: z.literal("service"),
    date: z.iso.datetime(),
    amount: z.number().positive(),
    odometerAtEntry: z.number().int().nonnegative(),
    description: z.string().trim().max(500).optional(),
    place: z.string().trim().max(200).optional(),
    enteredByName: z.string().trim().min(1).max(200),
    notes: z.string().trim().max(2000).optional(),
  }),
  z.object({
    type: z.literal("repair"),
    date: z.iso.datetime(),
    amount: z.number().positive(),
    odometerAtEntry: z.number().int().nonnegative(),
    description: z.string().trim().max(500).optional(),
    place: z.string().trim().max(200).optional(),
    enteredByName: z.string().trim().min(1).max(200),
    notes: z.string().trim().max(2000).optional(),
  }),
  z.object({
    type: z.literal("expense"),
    date: z.iso.datetime(),
    amount: z.number().positive(),
    odometerAtEntry: z.number().int().nonnegative(),
    category: z.enum(Object.values(ExpenseCategory) as [string, ...string[]]),
    place: z.string().trim().max(200).optional(),
    enteredByName: z.string().trim().min(1).max(200),
    notes: z.string().trim().max(2000).optional(),
  }),
  z.object({
    type: z.literal("odometer"),
    date: z.iso.datetime(),
    odometerKm: z.number().int().nonnegative(),
    enteredByName: z.string().trim().min(1).max(200),
    notes: z.string().trim().max(2000).optional(),
  }),
]);

export const updateJobStatusSchema = z.object({
  status: z.enum(Object.values(JobStatus) as [string, ...string[]]),
});

// Generic partial update for /api/v1/records/:id. The route resolves which
// of the five record tables the id belongs to first, then applies only the
// fields relevant to that type — unrelated fields sent in the body are
// simply ignored rather than rejected, since the caller has no way to know
// a record's type from its id alone.
export const updateRecordSchema = z
  .object({
    date: z.iso.datetime().optional(),
    amount: z.number().positive().optional(),
    odometerAtEntry: z.number().int().nonnegative().optional(),
    odometerKm: z.number().int().nonnegative().optional(),
    litres: z.number().positive().optional(),
    description: z.string().trim().max(500).optional(),
    category: z.enum(enumValues(ExpenseCategory)).optional(),
    place: z.string().trim().max(200).optional(),
    notes: z.string().trim().max(2000).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: "No fields to update." });

export const createDocumentSchema = z
  .object({
    documentTypeId: z.string().min(1).optional(),
    documentTypeCode: z.string().trim().min(1).optional(),
    title: z.string().trim().min(1).max(200),
    expiryDate: z.iso.datetime().optional(),
    fileKey: z.string().trim().max(500).optional(),
    // DATA-05 — optional, forward-looking only: nothing in the mobile app
    // sends this today, so it stays null on every document until a future
    // mobile change starts reporting the real upload size here.
    fileSizeBytes: z.number().int().nonnegative().optional(),
  })
  .refine((data) => Boolean(data.documentTypeId || data.documentTypeCode), {
    message: "documentTypeId or documentTypeCode is required.",
  });

export const updateDocumentSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    expiryDate: z.iso.datetime().optional(),
    fileKey: z.string().trim().max(500).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: "No fields to update." });

export const createProjectSchema = z.object({
  name: z.string().trim().max(200).optional(),
  budget: z.number().nonnegative(),
});

export const updateProjectSchema = z
  .object({
    name: z.string().trim().max(200).optional(),
    budget: z.number().nonnegative().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: "No fields to update." });

export const createStageSchema = z.object({
  name: z.string().trim().min(1).max(200),
  status: z.enum(enumValues(BuildStageStatus)).optional(),
});

export const updateStageSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    status: z.enum(enumValues(BuildStageStatus)).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: "No fields to update." });

export const createModificationSchema = z.object({
  name: z.string().trim().min(1).max(200),
  cost: z.number().nonnegative(),
});

export const createStagePartSchema = z.object({
  name: z.string().trim().min(1).max(200),
  cost: z.number().nonnegative(),
  supplier: z.string().trim().max(200).optional(),
  date: z.iso.datetime().optional(),
});

export const estimateDecisionSchema = z.object({
  decision: z.enum(enumValues(EstimateDecisionType)),
  note: z.string().trim().max(2000).optional(),
});

export const createAccessRequestSchema = z.object({
  workshopId: z.string().min(1),
  scope: z.string().trim().min(1).max(500),
});

export const approveAccessRequestSchema = z.object({
  scope: z.string().trim().min(1).max(500).optional(),
  expiresInDays: z.number().int().positive().max(365).optional(),
});

export const createReportSchema = z.object({
  scope: z.enum(enumValues(ReportScope)),
  scopeId: z.string().min(1),
  periodLabel: z.string().trim().min(1).max(100),
  recipients: z
    .array(
      z.object({
        email: z.email(),
        name: z.string().trim().max(200).optional(),
      }),
    )
    .max(50)
    .optional(),
});

export const updateAccountSchema = z
  .object({
    region: z.enum(enumValues(Region)).optional(),
    name: z.string().trim().min(1).max(200).optional(),
    activeProfileType: z.enum(enumValues(ProfileType)).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: "No fields to update." });

export const createWorkshopSchema = z.object({
  name: z.string().trim().min(1).max(200),
});

export const createWorkshopCustomerSchema = z.object({
  name: z.string().trim().min(1).max(200),
  phone: z.string().trim().max(50).optional(),
  linkedAccountId: z.string().min(1).optional(),
  notes: z.string().trim().max(2000).optional(),
});

export const createJobSchema = z.object({
  customerId: z.string().min(1),
  vehicleId: z.string().min(1).optional(),
  vehicleDescription: z.string().trim().max(200).optional(),
  faultDescription: z.string().trim().min(1).max(2000),
});

export const updateJobSchema = z
  .object({
    faultDescription: z.string().trim().min(1).max(2000).optional(),
    vehicleDescription: z.string().trim().max(200).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: "No fields to update." });

export const createJobLineSchema = z.object({
  kind: z.enum(enumValues(JobLineKind)).optional(),
  description: z.string().trim().min(1).max(500),
  cost: z.number().nonnegative(),
});
