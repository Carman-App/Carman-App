import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAccount } from "@/lib/api/auth";
import { requireWorkshopMembership, requireLiveAccessGrant } from "@/lib/api/authorize";
import { apiError, apiOk, apiOkPaginated } from "@/lib/api/response";
import { handleApiError, NotFoundError } from "@/lib/api/errors";
import { parsePagination } from "@/lib/api/pagination";
import { createJobSchema } from "@/lib/api/schemas";
import { assertCanCreateJob } from "@/lib/limits";
import { writeAuditLog } from "@/lib/audit";
import { JobStatus } from "@/generated/prisma/enums";
import { withApiLogging } from "@/lib/api/withLogging";

// GET /api/v1/workshops/:id/jobs — paginated, optionally filtered by ?status=.
// Chain: auth -> account -> membership -> query. Wrapped with structured
// request logging — the job board is one of the load-tested endpoints
// (section 21).
export const GET = withApiLogging(
  "workshops.jobs.list",
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  try {
    const account = await requireAccount(req);
    const { id: workshopId } = await params;

    await requireWorkshopMembership(account.id, workshopId);

    const { page, pageSize, skip, take } = parsePagination(req);
    const statusParam = req.nextUrl.searchParams.get("status");
    if (statusParam && !Object.values(JobStatus).includes(statusParam as JobStatus)) {
      return apiError(422, "VALIDATION_ERROR", `status must be one of: ${Object.values(JobStatus).join(", ")}.`);
    }
    const where = statusParam
      ? { workshopId, status: statusParam as JobStatus }
      : { workshopId };

    const [items, total] = await Promise.all([
      prisma.job.findMany({
        where,
        include: { customer: true, lines: true },
        orderBy: { createdAt: "desc" },
        skip,
        take,
      }),
      prisma.job.count({ where }),
    ]);

    return apiOkPaginated(items, { page, pageSize, total });
  } catch (error) {
    return handleApiError(error);
  }
  },
);

// POST /api/v1/workshops/:id/jobs — intake a new job.
// Chain: auth -> account -> membership -> plan limit -> validate -> customer belongs to workshop -> create -> audit log.
// Wrapped with structured request logging — job creation is load-tested
// (section 21).
export const POST = withApiLogging(
  "workshops.jobs.create",
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  try {
    const account = await requireAccount(req);
    const { id: workshopId } = await params;

    await requireWorkshopMembership(account.id, workshopId);
    await assertCanCreateJob(workshopId);

    const body = await req.json().catch(() => null);
    const parsed = createJobSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(422, "VALIDATION_ERROR", "Invalid job payload.", parsed.error.flatten());
    }
    const input = parsed.data;

    const customer = await prisma.workshopCustomer.findUnique({ where: { id: input.customerId } });
    if (!customer || customer.workshopId !== workshopId) {
      throw new NotFoundError("Customer not found for this workshop.");
    }

    // Consent gate (product spec section "the two sides meet"): linking a
    // job to a real Carma vehicle requires a live access grant on that
    // vehicle. A freeform vehicleDescription (no vehicleId) is always
    // allowed — that's the "customer not on Carma" path, nothing shared.
    if (input.vehicleId) {
      const vehicle = await prisma.vehicle.findUnique({
        where: { id: input.vehicleId },
        select: { id: true },
      });
      if (!vehicle) {
        throw new NotFoundError("Vehicle not found.");
      }
      await requireLiveAccessGrant(workshopId, input.vehicleId);
    }

    const job = await prisma.job.create({
      data: {
        workshopId,
        customerId: input.customerId,
        vehicleId: input.vehicleId,
        vehicleDescription: input.vehicleDescription,
        faultDescription: input.faultDescription,
      },
    });

    await writeAuditLog({
      actorId: account.id,
      action: "job.create",
      entityType: "Job",
      entityId: job.id,
    });

    return apiOk(job, 201);
  } catch (error) {
    return handleApiError(error);
  }
  },
);
