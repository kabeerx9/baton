import { useEffect, useReducer, useState } from "react";
import {
  derivePending,
  IDLE_PENDING,
  nextPendingTimes,
} from "./pending-timing";

/**
 * True while an indicator for `pending` should show: after the delay, and for
 * the minimum time. Timers belong to this effect, so unmount clears them.
 */
export function useDelayedPending(pending: boolean): boolean {
  const [times, dispatch] = useReducer(nextPendingTimes, IDLE_PENDING);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const at = Date.now();
    dispatch({ type: pending ? "start" : "end", now: at });
    setNow(at);
  }, [pending]);

  const { visible, recheckInMs } = derivePending(times, now);
  useEffect(() => {
    if (recheckInMs === null) return;
    const id = window.setTimeout(() => setNow(Date.now()), recheckInMs + 1);
    return () => window.clearTimeout(id);
  }, [recheckInMs, now, times]);

  return visible;
}
