import type {
  Breadcrumb,
  defaultStackParser,
  ErrorEvent,
  EventHint,
} from "@sentry/node";
import {
  errorChain,
  isSensitiveChain,
  knownDatabaseValues,
  redactedMessage,
  stackFrames,
} from "./database-error";

type StackParser = typeof defaultStackParser;
type ExceptionValue = NonNullable<
  NonNullable<ErrorEvent["exception"]>["values"]
>[number];
type Mechanism = NonNullable<ExceptionValue["mechanism"]>;

// As many linked errors as Sentry shows; the rest add nothing to triage.
const MAX_VALUES = 10;

// Contexts the SDK fills from the host, never from an error.
const SAFE_CONTEXTS = new Set([
  "os",
  "runtime",
  "app",
  "device",
  "culture",
  "trace",
  "cloud_resource",
]);
// Request breadcrumbs: their URLs are scrubbed, and nothing else is kept.
const SAFE_CRUMB_CATEGORIES = new Set(["navigation", "http", "fetch", "xhr"]);
const SAFE_CRUMB_DATA = ["method", "status_code", "url"] as const;

function safeBreadcrumb(crumb: Breadcrumb): Breadcrumb | null {
  if (!crumb.category || !SAFE_CRUMB_CATEGORIES.has(crumb.category))
    return null;
  const data: Record<string, unknown> = {};
  for (const key of SAFE_CRUMB_DATA)
    if (crumb.data?.[key] !== undefined) data[key] = crumb.data[key];
  return {
    category: crumb.category,
    ...(crumb.type !== undefined && { type: crumb.type }),
    ...(crumb.level !== undefined && { level: crumb.level }),
    ...(crumb.timestamp !== undefined && { timestamp: crumb.timestamp }),
    data,
  };
}

/**
 * Rewrites an event whose error is, wraps or groups a database error, or
 * whose chain could not be fully checked. The SDK's exception values are
 * replaced with values built from the chain (fixed messages, frames parsed
 * from stacks that pass the exact header rule), and every other free-text
 * part keeps only allowlisted fields. Nothing is matched back to text.
 */
export function redactDatabaseErrors(
  event: ErrorEvent,
  hint: EventHint | undefined,
  parser: StackParser | undefined,
): ErrorEvent {
  const root = hint?.originalException;
  if (!(root instanceof Error) || !isSensitiveChain(root)) return event;

  const links = errorChain(root).links.slice(0, MAX_VALUES);
  const avoid = knownDatabaseValues(root);
  const rootMechanism = event.exception?.values?.at(-1)?.mechanism;
  const grouped = links.length > 1;

  const values = links.map(({ error, source, parent }, id): ExceptionValue => {
    const frames = stackFrames(error, avoid);
    const parsed = frames !== undefined && parser ? parser(frames) : [];
    const mechanism: Mechanism =
      parent === null
        ? {
            type: "generic",
            handled: true,
            ...rootMechanism,
            ...(grouped && { exception_id: id }),
            ...(root instanceof AggregateError && { is_exception_group: true }),
          }
        : {
            type: "chained",
            handled: rootMechanism?.handled ?? true,
            source,
            exception_id: id,
            parent_id: parent,
          };
    return {
      type: error.name,
      // Every node of a database chain, siblings included, is redacted.
      value: redactedMessage(error, true),
      ...(parsed.length > 0 && { stacktrace: { frames: parsed } }),
      mechanism,
    };
  });

  const contexts = Object.fromEntries(
    Object.entries(event.contexts ?? {}).filter(([key]) =>
      SAFE_CONTEXTS.has(key),
    ),
  );
  const breadcrumbs = (event.breadcrumbs ?? [])
    .map(safeBreadcrumb)
    .filter((crumb): crumb is Breadcrumb => crumb !== null);

  const {
    extra: _extra,
    message: _message,
    logentry: _logentry,
    ...rest
  } = event;
  return {
    ...rest,
    // The SDK lists the root last; so do these values.
    exception: { ...event.exception, values: values.reverse() },
    contexts,
    breadcrumbs,
  };
}
