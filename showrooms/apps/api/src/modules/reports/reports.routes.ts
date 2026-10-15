import { Router } from "express";
import { z } from "zod";
import { createReportSchema, objectIdSchema } from "@showrooms/shared";
import { describeRoute } from "../../docs/openapi";
import { authenticate, requireAuth } from "../../middleware/auth";
import { AppError } from "../../utils/app-error";
import { created, handler } from "../../utils/handler";
import { notify } from "../notifications/notifications.service";
import { getSettings } from "../settings/settings.service";
import { User } from "../users/user.model";
import { Vehicle } from "../vehicles/vehicle.model";
import { VehicleReport } from "./report.model";

/** POST /vehicles/:vehicleId/reports */
export function vehicleReportRoutes(): Router {
  const router = Router({ mergeParams: true });
  router.post(
    "/",
    authenticate,
    handler({ params: z.object({ vehicleId: objectIdSchema }), body: createReportSchema }, async ({ req, res, params, body }) => {
      const auth = requireAuth(req);
      const vehicle = await Vehicle.findById(params.vehicleId);
      if (!vehicle || !["ACTIVE", "SOLD"].includes(vehicle.status)) throw AppError.notFound("Vehicle");
      if (String(vehicle.sellerId) === auth.userId) throw AppError.badRequest("You can't report your own listing");
      if (await VehicleReport.exists({ vehicleId: vehicle._id, reporterId: auth.userId, status: { $in: ["OPEN", "REVIEWING"] } })) {
        throw AppError.conflict("You've already reported this listing. Our team is looking into it.");
      }

      const report = await VehicleReport.create({ vehicleId: vehicle._id, sellerId: vehicle.sellerId, reporterId: auth.userId, reason: body.reason, details: body.details });

      // Enough independent reports put the listing at the top of the moderation queue.
      const { reportAutoFlagThreshold } = await getSettings();
      const open = await VehicleReport.countDocuments({ vehicleId: vehicle._id, status: { $in: ["OPEN", "REVIEWING"] } });
      if (open >= reportAutoFlagThreshold && !vehicle.flagReasons.includes("REPORTED")) {
        vehicle.flagged = true;
        vehicle.flagReasons.push("REPORTED");
        await vehicle.save();
        const admins = await User.find({ role: "ADMIN", status: "ACTIVE" }).select("_id").lean();
        await notify(admins.map((a) => a._id), {
          type: "LISTING_FLAGGED",
          title: "Listing flagged by buyers",
          body: `${vehicle.title} has ${open} open reports.`,
          data: { vehicleId: String(vehicle._id) },
        });
      }
      created(res, { id: String(report._id), status: report.status, message: "Thanks. Our team will review this listing." });
    }),
  );
  return router;
}

describeRoute({ method: "post", path: "/vehicles/:vehicleId/reports", tag: "Reports", summary: "Report a suspicious listing", auth: true, body: createReportSchema, responses: { 201: "Reported", 409: "Already reported" } });
