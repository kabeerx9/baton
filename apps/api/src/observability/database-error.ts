// Database errors carry row values: Drizzle's message and `params`, and
// pg's message, `detail`, `where` and `hint` (for example `invalid input
// syntax for type uuid: "<value>"`). These helpers keep only fields the
// server fills from the schema, and never look inside the text.
import { DrizzleQueryError } from "drizzle-orm/errors";
import { DatabaseError } from "pg";

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

/** A pg server error, by class or, for another copy of pg, by its shape. */
export function isPgError(value: unknown): value is Error & PgFields {
  if (value instanceof DatabaseError) return true;
  if (!(value instanceof Error)) return false;
  const v = value as Error & { code?: unknown; severity?: unknown };
  return (
    typeof v.code === "string" &&
    /^[0-9A-Z]{5}$/.test(v.code) &&
    typeof v.severity === "string" &&
    "routine" in v
  );
}

export function isDrizzleQueryError(
  value: unknown,
): value is DrizzleQueryError {
  return value instanceof DrizzleQueryError;
}

export function isDatabaseError(value: unknown): value is Error {
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

/**
 * The stack's frame lines only. V8 starts a stack with `<name>: <message>`;
 * that prefix is cut by the message's length, not found in the text. A
 * stack that does not start with it is dropped.
 */
export function stackFrames(error: Error): string | undefined {
  const { stack } = error;
  if (typeof stack !== "string") return undefined;
  const header = error.message ? `${error.name}: ${error.message}` : error.name;
  if (!stack.startsWith(header)) return undefined;
  return stack.slice(header.length);
}

/** The stack with the safe message in place of the original. */
export function safeDatabaseStack(error: Error): string | undefined {
  const frames = stackFrames(error);
  return frames === undefined
    ? undefined
    : `${error.name}: ${safeDatabaseMessage(error)}${frames}`;
}

export type SafeDatabaseError = {
  name: string;
  message: string;
  stack?: string;
  query?: string;
} & PgFields;

/** The loggable form of a database error: schema facts and SQL, no values. */
export function serializeDatabaseError(error: Error): SafeDatabaseError {
  const out: SafeDatabaseError = {
    name: error.name,
    message: safeDatabaseMessage(error),
  };
  const stack = safeDatabaseStack(error);
  if (stack !== undefined) out.stack = stack;
  if (isDrizzleQueryError(error)) {
    // Drizzle sends values as $n parameters, so the SQL holds none.
    if (typeof error.query === "string") out.query = error.query;
    if (isPgError(error.cause)) Object.assign(out, pgFields(error.cause));
  } else if (isPgError(error)) Object.assign(out, pgFields(error));
  return out;
}
