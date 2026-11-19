// Database errors carry row values: Drizzle's message and `params`, and
// pg's message, `detail`, `where` and `hint` (for example `invalid input
// syntax for type uuid: "<value>"`). These helpers keep only fields the
// server fills from the schema, and never look inside the text.
//
// Detection is by shape, never `instanceof`: importing pg here would load it
// before instrument.ts calls Sentry.init, and pg would then send no spans.

const CONDITIONS: Record<string, string> = {
  "08000": "connection_exception",
  "08006": "connection_failure",
  "22001": "string_data_right_truncation",
  "22003": "numeric_value_out_of_range",
  "22007": "invalid_datetime_format",
  "22P02": "invalid_text_representation",
  "23502": "not_null_violation",
  "23503": "foreign_key_violation",
  "23505": "unique_violation",
  "23514": "check_violation",
  "23P01": "exclusion_violation",
  "25P02": "in_failed_sql_transaction",
  "40001": "serialization_failure",
  "40P01": "deadlock_detected",
  "42501": "insufficient_privilege",
  "42601": "syntax_error",
  "42703": "undefined_column",
  "42P01": "undefined_table",
  "53300": "too_many_connections",
  "55P03": "lock_not_available",
  "57014": "query_canceled",
  "57P01": "admin_shutdown",
};

type PgFields = {
  code?: string;
  constraint?: string;
  table?: string;
  column?: string;
  schema?: string;
  routine?: string;
};

/** A pg server error (pg's DatabaseError), by its shape. */
export function isPgError(value: unknown): value is Error & PgFields {
  if (!(value instanceof Error)) return false;
  const v = value as Error & { code?: unknown; severity?: unknown };
  return (
    typeof v.code === "string" &&
    /^[0-9A-Z]{5}$/.test(v.code) &&
    typeof v.severity === "string" &&
    "routine" in v
  );
}

/** The parts of drizzle-orm's DrizzleQueryError that this module reads. */
export type DrizzleQueryErrorShape = Error & {
  query: string;
  params: unknown[];
};

/** A drizzle-orm DrizzleQueryError, by its shape. */
export function isDrizzleQueryError(
  value: unknown,
): value is DrizzleQueryErrorShape {
  if (!(value instanceof Error)) return false;
  const v = value as Error & { query?: unknown; params?: unknown };
  return (
    typeof v.query === "string" &&
    Array.isArray(v.params) &&
    v.message.startsWith("Failed query: ")
  );
}

export function isDatabaseError(value: unknown): boolean {
  return isDrizzleQueryError(value) || isPgError(value);
}

function pgFields(error: Error & PgFields): PgFields {
  const out: PgFields = {};
  for (const key of [
    "code",
    "constraint",
    "table",
    "column",
    "schema",
    "routine",
  ] as const) {
    const value = error[key];
    if (typeof value === "string" && value) out[key] = value;
  }
  return out;
}

function describe(fields: PgFields): string {
  if (!fields.code) return "";
  const condition = CONDITIONS[fields.code];
  const target = fields.table
    ? ` on ${fields.table}${fields.column ? `.${fields.column}` : ""}`
    : "";
  return ` (pg ${fields.code}${condition ? ` ${condition}` : ""}${target})`;
}

/** The fixed message that replaces a database error's own. */
export function safeDatabaseMessage(error: Error): string {
  if (isDrizzleQueryError(error)) {
    const cause = isPgError(error.cause) ? pgFields(error.cause) : {};
    return `Failed query${describe(cause)}`;
  }
  return `Database error${describe(isPgError(error) ? pgFields(error) : {})}`;
}

// Far beyond any real chain; a walk that reaches it cannot be trusted.
const MAX_WALK = 1_000;

/** One error in a chain: how it was reached and from which parent. */
export type ChainLink = {
  error: Error;
  source: string;
  parent: number | null;
};

/**
 * The walk over an error, its causes and an AggregateError's errors,
 * breadth first, root first. `complete` is false when the walk hit its
 * cap, met an error twice (a cycle) or a property getter threw: what it
 * did not see may be a database error.
 */
export type ErrorChain = { links: ChainLink[]; complete: boolean };

export function errorChain(root: Error): ErrorChain {
  const links: ChainLink[] = [];
  const seen = new Set<Error>();
  const queue: Array<{
    value: unknown;
    source: string;
    parent: number | null;
  }> = [{ value: root, source: "", parent: null }];
  try {
    for (let next = queue.shift(); next; next = queue.shift()) {
      const { value, source, parent } = next;
      if (!(value instanceof Error)) continue;
      if (seen.has(value) || links.length >= MAX_WALK)
        return { links, complete: false };
      seen.add(value);
      const index = links.push({ error: value, source, parent }) - 1;
      queue.push({ value: value.cause, source: "cause", parent: index });
      if (value instanceof AggregateError) {
        const children: unknown[] = Array.from(value.errors);
        children.forEach((child, i) =>
          queue.push({ value: child, source: `errors[${i}]`, parent: index }),
        );
      }
    }
  } catch {
    return { links, complete: false };
  }
  return { links, complete: true };
}

/**
 * Whether an error's chain may carry row values. "unknown" (a walk that
 * could not finish) is handled exactly like "database".
 */
export type ChainSensitivity = "none" | "database" | "unknown";

export function chainSensitivity(error: Error): ChainSensitivity {
  const { links, complete } = errorChain(error);
  try {
    if (links.some((link) => isDatabaseError(link.error))) return "database";
  } catch {
    return "unknown";
  }
  return complete ? "none" : "unknown";
}

export function isSensitiveChain(error: Error): boolean {
  return chainSensitivity(error) !== "none";
}

// Pieces shorter than this are too common to tell a value from code.
const MIN_VALUE_PIECE = 6;

/**
 * Text that a database error is known to carry: Drizzle's params and pg's
 * value fields, line by line. A stack holding any of it is dropped.
 */
export function knownDatabaseValues(error: Error): string[] {
  const out: string[] = [];
  for (const { error: link } of errorChain(error).links) {
    if (!isDatabaseError(link)) continue;
    const texts: unknown[] = [];
    if (isDrizzleQueryError(link) && Array.isArray(link.params))
      texts.push(...link.params);
    const fields = link as {
      detail?: unknown;
      where?: unknown;
      hint?: unknown;
      internalQuery?: unknown;
    };
    texts.push(fields.detail, fields.where, fields.hint, fields.internalQuery);
    for (const text of texts) {
      if (typeof text !== "string" && typeof text !== "number") continue;
      for (const piece of String(text).split("\n")) {
        const trimmed = piece.trim();
        if (trimmed.length >= MIN_VALUE_PIECE) out.push(trimmed);
      }
    }
  }
  return out;
}

/**
 * The stack's frame lines only. A V8 stack starts with the exact line
 * `<name>: <message>` (or `<name>` for an empty message), so the header is
 * cut by the error's own strings; any other start drops the stack, as does
 * frame text that holds a known database value.
 */
export function stackFrames(
  error: Error,
  avoid: readonly string[] = [],
): string | undefined {
  const { stack } = error;
  if (typeof stack !== "string") return undefined;
  const header = error.message ? `${error.name}: ${error.message}` : error.name;
  if (stack !== header && !stack.startsWith(`${header}\n`)) return undefined;
  const frames = stack.slice(header.length);
  if (avoid.some((value) => frames.includes(value))) return undefined;
  return frames;
}

/** The message to log or send: fixed for a database error and its wrappers. */
export function redactedMessage(error: Error): string {
  if (isDatabaseError(error)) return safeDatabaseMessage(error);
  switch (chainSensitivity(error)) {
    case "database":
      return `${error.name} (wraps a database error)`;
    case "unknown":
      return `${error.name} (may wrap a database error)`;
    case "none":
      return error.message;
  }
}

export type RedactedError = {
  name: string;
  message: string;
  stack?: string;
  query?: string;
} & PgFields;

/**
 * The loggable form of an error that is or holds a database error: schema
 * facts and SQL, never values or the raw message.
 */
export function serializeRedactedError(error: Error): RedactedError {
  const message = redactedMessage(error);
  const out: RedactedError = { name: error.name, message };
  const frames = stackFrames(error, knownDatabaseValues(error));
  if (frames !== undefined) out.stack = `${error.name}: ${message}${frames}`;
  if (isDrizzleQueryError(error)) {
    // Drizzle sends values as $n parameters, so the SQL holds none.
    if (typeof error.query === "string") out.query = error.query;
    if (isPgError(error.cause)) Object.assign(out, pgFields(error.cause));
  } else if (isPgError(error)) Object.assign(out, pgFields(error));
  return out;
}
