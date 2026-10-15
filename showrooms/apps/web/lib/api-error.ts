import type { ApiErrorBody } from "@showrooms/shared";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }

  static async from(res: Response): Promise<ApiError> {
    const body = (await res.json().catch(() => null)) as ApiErrorBody | null;
    return new ApiError(res.status, body?.error.code ?? "INTERNAL_ERROR", body?.error.message ?? `Request failed (${res.status})`, body?.error.details);
  }

  /** Field errors from a 422, keyed by path, for react-hook-form. */
  fieldErrors(): Record<string, string> {
    if (!Array.isArray(this.details)) return {};
    return Object.fromEntries((this.details as { path: string; message: string }[]).map((d) => [d.path, d.message]));
  }
}

export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error && err.name === "TypeError") return "Can't reach Showrooms. Check your connection and try again.";
  return "Something went wrong. Please try again.";
}
