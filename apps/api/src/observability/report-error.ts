import * as Sentry from "@sentry/node";
import { HTTPException } from "hono/http-exception";

/** Expected refusals (3xx/4xx HTTPExceptions) are not reported; everything else is. */
export function shouldReportError(error: unknown): boolean {
  return !(error instanceof HTTPException) || error.status >= 500;
}

/**
 * The single place that reports request errors. The Hono integration is told
 * not to capture (instrument.ts), so each failure is one Sentry event.
 */
export function reportRequestError(error: unknown) {
  if (shouldReportError(error)) Sentry.captureException(error);
}
