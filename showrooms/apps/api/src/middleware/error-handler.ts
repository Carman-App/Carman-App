import type { ErrorRequestHandler, RequestHandler } from "express";
import mongoose from "mongoose";
import { ZodError } from "zod";
import { logger } from "../config/logger";
import { AppError } from "../utils/app-error";

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(new AppError(404, "NOT_FOUND", `No route for ${req.method} ${req.path}`));
};

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  const requestId = req.id ? String(req.id) : undefined;
  let error: AppError;

  if (err instanceof AppError) {
    error = err;
  } else if (err instanceof ZodError) {
    error = new AppError(
      422,
      "VALIDATION_ERROR",
      "Some fields are invalid",
      err.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
    );
  } else if (err instanceof mongoose.Error.CastError) {
    error = AppError.badRequest(`Invalid value for ${err.path}`);
  } else if (isDuplicateKeyError(err)) {
    error = AppError.conflict("That record already exists");
  } else if (err?.type === "entity.parse.failed") {
    error = AppError.badRequest("Request body is not valid JSON");
  } else if (err?.type === "entity.too.large") {
    error = new AppError(413, "BAD_REQUEST", "Request body is too large");
  } else {
    logger.error({ err, requestId }, "Unhandled error");
    error = new AppError(500, "INTERNAL_ERROR", "Something went wrong. Please try again.");
  }

  res.status(error.status).json({
    error: { code: error.code, message: error.message, details: error.details, requestId },
  });
};

function isDuplicateKeyError(err: unknown): boolean {
  return typeof err === "object" && err !== null && "code" in err && (err as { code: unknown }).code === 11000;
}
