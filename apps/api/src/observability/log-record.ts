import {
  isSensitiveChain,
  knownDatabaseValues,
  serializeRedactedError,
} from "./database-error";
import type { LogLevel } from "./log-level";
import type { RequestContext } from "./request-context";
import { FILTERED, scrubDeep, scrubText } from "./scrub";

export type LogAttributes = Record<string, unknown>;

export type LogRecord = {
  ts: string;
  level: LogLevel;
  msg: string;
  request_id?: string;
  workspace_id?: string;
  user_id?: string;
} & LogAttributes;

const MAX_DEPTH = 6;
const UNREADABLE = "[Unreadable error]";

/** A property read that a throwing getter cannot break. */
function readSafely(read: () => unknown): unknown {
  try {
    return read();
  } catch {
    return undefined;
  }
}

/** A chain whose root is or holds a database error, and its known values. */
type DatabaseChain = { avoid: readonly string[] };

function errorToLoggable(
  value: Error,
  depth: number,
  seen: WeakSet<object>,
  chain: DatabaseChain | undefined,
): Record<string, unknown> {
  const cause = readSafely(() => value.cause);
  // Decided once at the root and passed down: a sibling or cause inside a
  // database chain is redacted even when its own branch holds no DB error.
  const inChain =
    chain ??
    (isSensitiveChain(value)
      ? { avoid: knownDatabaseValues(value) }
      : undefined);
  if (inChain) {
    // Never a raw message, params or pg detail (row values).
    const out: Record<string, unknown> = {
      ...serializeRedactedError(value, inChain.avoid),
    };
    if (depth < MAX_DEPTH) {
      if (cause !== undefined)
        out.cause =
          cause instanceof Error
            ? toLoggable(cause, depth + 1, seen, inChain)
            : FILTERED;
      const errors = readSafely(() =>
        value instanceof AggregateError ? Array.from(value.errors) : undefined,
      );
      if (Array.isArray(errors))
        out.errors = errors.map((e) =>
          e instanceof Error
            ? toLoggable(e, depth + 1, seen, inChain)
            : FILTERED,
        );
    }
    return out;
  }
  const out: Record<string, unknown> = {
    name: value.name,
    message: value.message,
    stack: value.stack,
  };
  const code = (value as { code?: unknown }).code;
  if (typeof code === "string" || typeof code === "number") out.code = code;
  if (cause !== undefined && depth < MAX_DEPTH)
    out.cause = toLoggable(cause, depth + 1, seen);
  return out;
}

/** Turns any value into plain JSON data: Errors keep name, message and stack. */
export function toLoggable(
  value: unknown,
  depth = 0,
  seen = new WeakSet<object>(),
  chain?: DatabaseChain,
): unknown {
  if (value instanceof Error) {
    // An error whose own getters throw is logged by its kind only.
    try {
      return errorToLoggable(value, depth, seen, chain);
    } catch {
      return { name: "Error", message: UNREADABLE };
    }
  }
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "function" || typeof value === "symbol")
    return String(value);
  if (value === null || typeof value !== "object") return value;
  if (value instanceof Date) return value.toISOString();
  if (seen.has(value) || depth >= MAX_DEPTH) return "[Truncated]";
  seen.add(value);
  if (Array.isArray(value))
    return value.map((item) => toLoggable(item, depth + 1, seen));
  const out: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value))
    out[key] = toLoggable(item, depth + 1, seen);
  return out;
}

const RESERVED = new Set([
  "ts",
  "level",
  "msg",
  "request_id",
  "workspace_id",
  "user_id",
]);

/** The scrubbed record for one call. Context fields win over same-named attributes. */
export function buildLogRecord(
  level: LogLevel,
  message: string,
  attributes: LogAttributes | undefined,
  context: RequestContext | undefined,
  now: Date,
): LogRecord {
  const record: LogRecord = {
    ts: now.toISOString(),
    level,
    msg: scrubText(message),
  };
  if (attributes) {
    const safe = scrubDeep(toLoggable(attributes)) as LogAttributes;
    for (const [key, value] of Object.entries(safe))
      if (!RESERVED.has(key) && value !== undefined) record[key] = value;
  }
  if (context) {
    record.request_id = context.requestId;
    if (context.workspaceId) record.workspace_id = context.workspaceId;
    if (context.userId) record.user_id = context.userId;
  }
  return record;
}

export function formatJson(record: LogRecord): string {
  return JSON.stringify(record);
}

/** One readable line for local development. */
export function formatPretty(record: LogRecord): string {
  const { ts, level, msg, ...rest } = record;
  const time = ts.slice(11, 23);
  const fields = Object.entries(rest)
    .map(
      ([key, value]) =>
        `${key}=${typeof value === "string" ? value : JSON.stringify(value)}`,
    )
    .join(" ");
  const line = `${time} ${level.toUpperCase().padEnd(5)} ${msg}`;
  return fields ? `${line} ${fields}` : line;
}
