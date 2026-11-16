/**
 * Lifecycle of one realtime socket, as one union with one pure transition.
 * The driver in `create-connection.ts` owns the socket, timers and listeners
 * that follow from the state.
 */
export type ConnectionState<R extends string> =
  | { status: "connecting"; failures: number }
  // Open for less than 30 s: failures are still remembered.
  | { status: "open"; failures: number }
  // Open for 30 s: failures are forgotten.
  | { status: "stable" }
  // `hurried` allows one early retry per wait (a wake while waiting).
  // `recheck` is set only after a session check that gave no answer: the
  // retry repeats the check instead of opening a socket.
  | {
      status: "waiting";
      failures: number;
      hurried: boolean;
      recheck: boolean;
    }
  // The session check after close 4001 is in flight.
  | { status: "checking"; failures: number }
  | { status: "ended"; reason: R | "disposed" | "session-ended" };

export type CloseVerdict<R extends string> =
  | "retry"
  | "check-session"
  | { end: R };

export type SessionResult = "same" | "gone" | "unknown";

export type ConnectionEvent<R extends string> =
  | { type: "opened" }
  | { type: "stable" }
  | { type: "retry-due" }
  | { type: "wake" }
  | { type: "closed"; verdict: CloseVerdict<R> }
  | { type: "session"; result: SessionResult }
  | { type: "end"; reason: R | "disposed" };

// Failures at which the caller's fallback poll starts.
export const POLL_AFTER_FAILURES = 5;

/** Returns the same object when the event changes nothing. */
export function transition<R extends string>(
  state: ConnectionState<R>,
  event: ConnectionEvent<R>,
): ConnectionState<R> {
  if (state.status === "ended") return state;
  if (event.type === "end") return { status: "ended", reason: event.reason };

  switch (state.status) {
    case "connecting":
      if (event.type === "opened")
        return { status: "open", failures: state.failures };
      return afterClose(state, event);
    case "open":
      if (event.type === "stable") return { status: "stable" };
      return afterClose(state, event);
    case "stable":
      return afterClose(state, event);
    case "waiting":
      if (event.type === "retry-due")
        return {
          status: state.recheck ? "checking" : "connecting",
          failures: state.failures,
        };
      if (event.type === "wake" && !state.hurried)
        return { ...state, hurried: true };
      if (event.type === "closed" && typeof event.verdict === "object")
        return { status: "ended", reason: event.verdict.end };
      return state;
    case "checking":
      if (event.type === "session") {
        if (event.result === "same")
          return { status: "connecting", failures: state.failures };
        if (event.result === "gone")
          return { status: "ended", reason: "session-ended" };
        return {
          status: "waiting",
          failures: state.failures + 1,
          hurried: false,
          recheck: true,
        };
      }
      if (event.type === "closed" && typeof event.verdict === "object")
        return { status: "ended", reason: event.verdict.end };
      return state;
  }
}

function afterClose<R extends string>(
  state: Extract<
    ConnectionState<R>,
    { status: "connecting" | "open" | "stable" }
  >,
  event: ConnectionEvent<R>,
): ConnectionState<R> {
  if (event.type !== "closed") return state;
  const failures = (state.status === "stable" ? 0 : state.failures) + 1;
  if (event.verdict === "retry")
    return { status: "waiting", failures, hurried: false, recheck: false };
  if (event.verdict === "check-session")
    return { status: "checking", failures };
  return { status: "ended", reason: event.verdict.end };
}

/** True when the socket is open. Only these states count as live. */
export function isLive(state: ConnectionState<string>) {
  return state.status === "open" || state.status === "stable";
}

/** True when the driver holds a socket, open or not yet open. */
export function holdsSocket(state: ConnectionState<string>) {
  return state.status === "connecting" || isLive(state);
}

/** True when realtime delivery has failed long enough to poll instead. */
export function shouldPoll(state: ConnectionState<string>) {
  return (
    (state.status === "connecting" ||
      state.status === "waiting" ||
      state.status === "checking") &&
    state.failures >= POLL_AFTER_FAILURES
  );
}
