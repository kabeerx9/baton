import { APIError } from "better-auth/api";
import { ApiError } from "../../errors/api-error";

const STATUS = {
  400: "BAD_REQUEST",
  401: "UNAUTHORIZED",
  403: "FORBIDDEN",
  404: "NOT_FOUND",
  409: "CONFLICT",
} as const;

/** Baton throws `ApiError`; a provider hook must throw the provider's error to keep its status. */
export function toProviderError(error: unknown): unknown {
  if (!(error instanceof ApiError)) return error;
  const status =
    STATUS[error.status as keyof typeof STATUS] ?? "INTERNAL_SERVER_ERROR";
  return new APIError(status, { code: error.code, message: error.message });
}
