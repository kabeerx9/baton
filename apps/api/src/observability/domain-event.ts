import * as Sentry from "@sentry/node";
import type { LogAttributes } from "./log-record";
import { logger } from "./logger";

/**
 * A breadcrumb only: for frequent steps (every published event) that would
 * cost too much Sentry Logs quota as log lines.
 */
export function addDomainBreadcrumb(
  category: string,
  message: string,
  attributes: LogAttributes = {},
) {
  Sentry.addBreadcrumb({ category, message, level: "info", data: attributes });
}

/**
 * A meaningful domain step (outbox delivery, cron run, change-request
 * decision): one breadcrumb for the next error report and one info line on
 * stdout and in Sentry Logs. Pass ids, counts and outcomes only, never task
 * content, emails or tokens.
 */
export function recordDomainEvent(
  category: string,
  message: string,
  attributes: LogAttributes = {},
) {
  addDomainBreadcrumb(category, message, attributes);
  logger.info(message, { category, ...attributes }, { sentry: true });
}
