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
  "sentry.segment.name",
  "sentry.sdk.name",
  "sentry.sdk.version",
  "sentry.environment",
  "sentry.release",
  "sentry.is_localhost",
]);
const STATUS_MESSAGE = "sentry.status.message";
export const DATABASE_STATUS_MESSAGE = "database error";

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
  return { ...span, attributes };
}
