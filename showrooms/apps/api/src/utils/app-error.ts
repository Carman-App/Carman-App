import type { ApiErrorCode } from "@showrooms/shared";

export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: ApiErrorCode,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
  }

  static badRequest(message: string, details?: unknown) {
    return new AppError(400, "BAD_REQUEST", message, details);
  }
  static unauthenticated(message = "Sign in to continue", code: ApiErrorCode = "UNAUTHENTICATED") {
    return new AppError(401, code, message);
  }
  static forbidden(message = "You do not have permission to do that") {
    return new AppError(403, "FORBIDDEN", message);
  }
  static notFound(what = "Resource") {
    return new AppError(404, "NOT_FOUND", `${what} not found`);
  }
  static conflict(message: string, code: ApiErrorCode = "CONFLICT") {
    return new AppError(409, code, message);
  }
}
