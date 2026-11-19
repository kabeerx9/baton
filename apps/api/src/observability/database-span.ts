// Database spans copy driver facts into attributes, and pg's instrumentation
// puts the error message in `sentry.status.message`; for a rejected value
// that message is the value. A database span keeps only these attributes.
const DATABASE_ATTRIBUTES = new Set([
  "db.system",
  "db.system.name",
  "db.operation",
  "db.operation.name",
  "db.namespace",
  "db.name",
  "db.collection.name",
  // The statement as the driver sent it: values are $n parameters.
  "db.statement",
  "db.query.text",
  "db.query.summary",
  "server.address",
  "server.port",
  "error.type",
]);
// What the SDK itself sets on every span: trace views need the segment ids.
const SDK_ATTRIBUTES = new Set([
  "sentry.op",
  "sentry.origin",
  "sentry.source",
  "sentry.kind",
  "sentry.trace_lifecycle",
  "sentry.segment.id",
  "sentry.sdk.name",
  "sentry.sdk.version",
  "sentry.environment",
  "sentry.release",
  "sentry.is_localhost",
]);
const STATUS_MESSAGE = "sentry.status.message";
const SEGMENT_NAME = "sentry.segment.name";
export const DATABASE_STATUS_MESSAGE = "database error";
// The SDK copies the parent span's name here, which a manual span may set
// to anything; a database span gets this fixed name instead.
export const DATABASE_SEGMENT_NAME = "database";

// Sentry's standard span statuses. Any other status message is free text
// (an error message) and is replaced.
const STANDARD_STATUSES = new Set([
  "ok",
  "cancelled",
  "unknown_error",
  "invalid_argument",
  "deadline_exceeded",
  "not_found",
  "already_exists",
  "permission_denied",
  "resource_exhausted",
  "failed_precondition",
  "aborted",
  "out_of_range",
  "unimplemented",
  "internal_error",
  "unavailable",
  "data_loss",
  "unauthenticated",
]);
export const FALLBACK_STATUS_MESSAGE = "internal_error";

type Spanish = { attributes?: Record<string, unknown> };

function stringAttribute(span: Spanish, key: string): string {
  const raw = span.attributes?.[key];
  const value =
    raw !== null && typeof raw === "object" && "value" in raw
      ? (raw as { value: unknown }).value
      : raw;
  return typeof value === "string" ? value : "";
}

/** A span about a database call, by its op, origin or db.system. */
export function isDatabaseSpan(span: Spanish): boolean {
  const attributes = span.attributes ?? {};
  return (
    stringAttribute(span, "sentry.op").startsWith("db") ||
    stringAttribute(span, "sentry.origin").startsWith("auto.db") ||
    "db.system" in attributes ||
    "db.system.name" in attributes
  );
}

/** A database span with allowlisted attributes and a fixed status message. */
export function redactDatabaseSpan<S extends Spanish>(span: S): S {
  if (!span.attributes || !isDatabaseSpan(span)) return span;
  const attributes: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(span.attributes))
    if (DATABASE_ATTRIBUTES.has(key) || SDK_ATTRIBUTES.has(key))
      attributes[key] = value;
  if (STATUS_MESSAGE in span.attributes)
    attributes[STATUS_MESSAGE] = DATABASE_STATUS_MESSAGE;
  if (SEGMENT_NAME in span.attributes)
    attributes[SEGMENT_NAME] = DATABASE_SEGMENT_NAME;
  return { ...span, attributes };
}

/** Any span: a status message that is not a standard status is replaced. */
export function redactSpanStatus<S extends Spanish>(span: S): S {
  if (!span.attributes || !(STATUS_MESSAGE in span.attributes)) return span;
  if (STANDARD_STATUSES.has(stringAttribute(span, STATUS_MESSAGE))) return span;
  const raw = span.attributes[STATUS_MESSAGE];
  const fixed =
    raw !== null && typeof raw === "object" && "value" in raw
      ? { ...(raw as object), value: FALLBACK_STATUS_MESSAGE }
      : FALLBACK_STATUS_MESSAGE;
  return {
    ...span,
    attributes: { ...span.attributes, [STATUS_MESSAGE]: fixed },
  };
}
