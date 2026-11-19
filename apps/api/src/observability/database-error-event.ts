import type { defaultStackParser, ErrorEvent, EventHint } from "@sentry/node";
import {
  isDatabaseError,
  safeDatabaseMessage,
  stackFrames,
} from "./database-error";
import { FILTERED } from "./scrub";

type StackParser = typeof defaultStackParser;

const MAX_CHAIN = 10;

/** The error and its causes, as Sentry's linked errors walks them. */
function errorChain(root: unknown): Error[] {
  const out: Error[] = [];
  const seen = new Set<unknown>();
  const queue: unknown[] = [root];
  while (queue.length && out.length < MAX_CHAIN) {
    const next = queue.shift();
    if (!(next instanceof Error) || seen.has(next)) continue;
    seen.add(next);
    out.push(next);
    queue.push(next.cause);
    if (next instanceof AggregateError) queue.push(...next.errors);
  }
  return out;
}

type ExceptionValue = NonNullable<
  NonNullable<ErrorEvent["exception"]>["values"]
>[number];

/**
 * Rewrites an event whose error chain holds a database error. Each
 * exception value is matched to its error by the exact message: a database
 * error gets its fixed message and frames parsed from its own stack; a value
 * that matches no error in the chain is filtered. Text is never searched.
 */
export function redactDatabaseErrors(
  event: ErrorEvent,
  hint: EventHint | undefined,
  parser: StackParser | undefined,
): ErrorEvent {
  const chain = errorChain(hint?.originalException);
  const database = chain.filter(isDatabaseError);
  if (!database.length || !event.exception?.values) return event;

  const other = new Set(
    chain.filter((e) => !database.includes(e)).map((e) => e.message),
  );
  const values = event.exception.values.map((value): ExceptionValue => {
    const match = database.find((e) => e.message === value.value);
    if (match) {
      const frames = stackFrames(match);
      const parsed = frames !== undefined && parser ? parser(frames) : [];
      const { stacktrace: _dropped, ...rest } = value;
      return {
        ...rest,
        value: safeDatabaseMessage(match),
        ...(parsed.length && { stacktrace: { frames: parsed } }),
      };
    }
    if (value.value === undefined || other.has(value.value)) return value;
    const { stacktrace: _dropped, ...rest } = value;
    return { ...rest, value: FILTERED };
  });

  // Extra error data copies an error's fields under its name.
  const contexts = event.contexts && { ...event.contexts };
  if (contexts) for (const error of database) delete contexts[error.name];

  return {
    ...event,
    exception: { ...event.exception, values },
    ...(contexts && { contexts }),
  };
}
