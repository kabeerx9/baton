import type { defaultStackParser, ErrorEvent, EventHint } from "@sentry/node";
import {
  errorChain,
  holdsDatabaseError,
  knownDatabaseValues,
  redactedMessage,
  stackFrames,
} from "./database-error";
import { FILTERED } from "./scrub";

type StackParser = typeof defaultStackParser;
type ExceptionValue = NonNullable<
  NonNullable<ErrorEvent["exception"]>["values"]
>[number];
type Mechanism = NonNullable<ExceptionValue["mechanism"]>;

/**
 * Rewrites an event whose error is, wraps or groups a database error. The
 * SDK's exception values are thrown away and rebuilt from the error chain
 * itself: fixed messages, and frames parsed from stacks that pass the exact
 * header rule. SDK text is never matched back to errors.
 */
export function redactDatabaseErrors(
  event: ErrorEvent,
  hint: EventHint | undefined,
  parser: StackParser | undefined,
): ErrorEvent {
  const root = hint?.originalException;
  if (!(root instanceof Error) || !holdsDatabaseError(root)) return event;

  const links = errorChain(root);
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
      value: redactedMessage(error),
      ...(parsed.length > 0 && { stacktrace: { frames: parsed } }),
      mechanism,
    };
  });

  // Raw text of every error that is or holds a database error: any other
  // part of the event that repeats it is dropped.
  const raw = links
    .filter(({ error }) => holdsDatabaseError(error))
    .map(({ error }) => error.message)
    .concat(avoid)
    .filter((text) => text.length > 0);
  const repeats = (value: unknown) => {
    if (value === undefined) return false;
    const text = typeof value === "string" ? value : JSON.stringify(value);
    return raw.some((r) => text.includes(r));
  };

  // Extra error data copies an error's fields under its name.
  const contexts = event.contexts && { ...event.contexts };
  if (contexts) for (const { error } of links) delete contexts[error.name];

  const out: ErrorEvent = {
    ...event,
    // The SDK's own values come last; ours keep its order: root last.
    exception: { ...event.exception, values: values.reverse() },
    ...(contexts && { contexts }),
  };
  if (repeats(out.message)) out.message = FILTERED;
  if (repeats(out.logentry)) delete out.logentry;
  if (out.breadcrumbs)
    out.breadcrumbs = out.breadcrumbs.filter((crumb) => !repeats(crumb));
  return out;
}
