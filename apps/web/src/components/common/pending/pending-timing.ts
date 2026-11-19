/** Nothing shows until a wait has lasted this long: fast loads flash nothing. */
export const SHOW_AFTER_MS = 300;
/** Once shown, a pending indicator stays at least this long. */
export const MIN_SHOWN_MS = 500;

/** One wait: when it began, and when it ended (null while it goes on). */
export type PendingTimes = {
  startedAt: number | null;
  endedAt: number | null;
};

export type PendingEvent = { type: "start" | "end"; now: number };

export const IDLE_PENDING: PendingTimes = { startedAt: null, endedAt: null };

export type PendingView = {
  visible: boolean;
  /** When to look again, or null if nothing changes without a new event. */
  recheckInMs: number | null;
};

/** The one place the wait lifecycle is decided. An unknown event changes nothing. */
export function derivePending(times: PendingTimes, now: number): PendingView {
  const { startedAt, endedAt } = times;
  if (startedAt === null) return { visible: false, recheckInMs: null };

  const showAt = startedAt + SHOW_AFTER_MS;
  if (endedAt !== null && endedAt <= showAt) {
    return { visible: false, recheckInMs: null };
  }
  const hideAt =
    endedAt === null
      ? Number.POSITIVE_INFINITY
      : Math.max(endedAt, showAt + MIN_SHOWN_MS);

  if (now < showAt) return { visible: false, recheckInMs: showAt - now };
  if (now < hideAt) {
    return {
      visible: true,
      recheckInMs: Number.isFinite(hideAt) ? hideAt - now : null,
    };
  }
  return { visible: false, recheckInMs: null };
}

export function nextPendingTimes(
  times: PendingTimes,
  event: PendingEvent,
): PendingTimes {
  if (event.type === "start") {
    if (times.startedAt !== null && times.endedAt === null) return times;
    // A new wait that begins while the last indicator still shows continues it.
    if (times.endedAt !== null && derivePending(times, event.now).visible) {
      return { startedAt: times.startedAt, endedAt: null };
    }
    return { startedAt: event.now, endedAt: null };
  }
  if (event.type === "end") {
    if (times.startedAt === null || times.endedAt !== null) return times;
    return { startedAt: times.startedAt, endedAt: event.now };
  }
  return times;
}
