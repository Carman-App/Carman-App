/** Every successful response is `{ data, meta? }`; every error is `{ error }`. */
export interface ApiSuccess<T, M = undefined> {
  data: T;
  meta?: M;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
    requestId?: string;
  };
}

export const API_ERROR_CODES = [
  "VALIDATION_ERROR",
  "BAD_REQUEST",
  "UNAUTHENTICATED",
  "TOKEN_EXPIRED",
  "INVALID_CREDENTIALS",
  "ACCOUNT_SUSPENDED",
  "FORBIDDEN",
  "NOT_FOUND",
  "CONFLICT",
  "EMAIL_TAKEN",
  "PHONE_TAKEN",
  "RATE_LIMITED",
  "INTERNAL_ERROR",
] as const;
export type ApiErrorCode = (typeof API_ERROR_CODES)[number];
