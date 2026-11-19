// The logger's contract: the message is a fixed string literal, and every
// detail (ids, counts, the error) goes in the attributes. Attributes are
// redacted by structure (log-record.ts, database-error.ts); a message built
// from an error or its values could copy database values past that.
// logger-contract.test.ts fails on a call that builds its message while
// passing an error, or builds it from one.
import * as Sentry from "@sentry/node";
import { isEnabled, type LogLevel, parseLogLevel } from "./log-level";
import {
  buildLogRecord,
  formatJson,
  formatPretty,
  type LogAttributes,
  type LogRecord,
} from "./log-record";
import { currentRequestContext } from "./request-context";

/**
 * Sentry Logs receive this level and above. Info lines reach Sentry only when
 * a call asks with `{ sentry: true }` (domain events), which keeps the access
 * log and routine info lines on stdout and out of the Sentry quota.
 */
export const SENTRY_LOG_MIN_LEVEL: LogLevel = "warn";

export type LogOptions = { sentry?: boolean };

export type SentryBridge = {
  enabled(): boolean;
  log(level: LogLevel, message: string, attributes: LogAttributes): void;
  capture(error: Error): void;
};

export type LoggerConfig = {
  level: LogLevel;
  pretty: boolean;
  write: (line: string) => void;
  sentry: SentryBridge;
  now?: () => Date;
};

export type Logger = {
  [L in LogLevel]: (
    message: string,
    attributes?: LogAttributes,
    options?: LogOptions,
  ) => void;
};

function firstError(attributes: LogAttributes | undefined): Error | undefined {
  if (!attributes) return undefined;
  for (const value of Object.values(attributes))
    if (value instanceof Error) return value;
  return undefined;
}

/** Sentry log attributes are flat: nested values go as JSON text. */
function sentryAttributes(record: LogRecord): LogAttributes {
  const { ts: _ts, level: _level, msg: _msg, ...rest } = record;
  const out: LogAttributes = {};
  for (const [key, value] of Object.entries(rest))
    out[key] =
      value !== null && typeof value === "object"
        ? JSON.stringify(value)
        : value;
  return out;
}

export function createLogger(config: LoggerConfig): Logger {
  const now = config.now ?? (() => new Date());
  const emit = (
    level: LogLevel,
    message: string,
    attributes?: LogAttributes,
    options?: LogOptions,
  ) => {
    try {
      const forward = options?.sentry ?? isEnabled(level, SENTRY_LOG_MIN_LEVEL);
      const toStdout = isEnabled(level, config.level);
      if (!toStdout && !forward) return;
      const record = buildLogRecord(
        level,
        message,
        attributes,
        currentRequestContext(),
        now(),
      );
      if (toStdout)
        config.write(config.pretty ? formatPretty(record) : formatJson(record));
      if (!config.sentry.enabled()) return;
      if (forward)
        config.sentry.log(level, record.msg, sentryAttributes(record));
      const error = level === "error" ? firstError(attributes) : undefined;
      if (error) config.sentry.capture(error);
    } catch {
      // Logging must never break the caller.
      try {
        config.write(
          JSON.stringify({
            ts: now().toISOString(),
            level,
            msg: "log line could not be built",
          }),
        );
      } catch {}
    }
  };
  return {
    debug: (m, a, o) => emit("debug", m, a, o),
    info: (m, a, o) => emit("info", m, a, o),
    warn: (m, a, o) => emit("warn", m, a, o),
    error: (m, a, o) => emit("error", m, a, o),
  };
}

export const sentryBridge: SentryBridge = {
  enabled: () => Sentry.isInitialized(),
  log: (level, message, attributes) =>
    Sentry.logger[level](message, attributes),
  // Sentry marks a captured Error, so a site that also captured it sends one event.
  capture: (error) => {
    Sentry.captureException(error);
  },
};

export const logger: Logger = createLogger({
  level: parseLogLevel(process.env.LOG_LEVEL, process.env.NODE_ENV),
  pretty: process.env.NODE_ENV !== "production",
  write: (line) => {
    process.stdout.write(`${line}\n`);
  },
  sentry: sentryBridge,
});
