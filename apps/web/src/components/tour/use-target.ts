import { useEffect, useReducer } from "react";
import {
  TARGET_WAITING,
  type TargetState,
  targetReducer,
} from "./target-state";

/** How long to wait for a target to mount before centering the card. */
export const TARGET_TIMEOUT_MS = 2000;

/** Follows one element on every frame, so layout shifts and scrolls track. */
export function useTarget(selector: string | null): TargetState {
  const [state, dispatch] = useReducer(
    targetReducer,
    selector ? TARGET_WAITING : { kind: "fallback" },
  );

  useEffect(() => {
    dispatch({ type: "RESET" });
    if (!selector) {
      dispatch({ type: "TIMEOUT" });
      return;
    }
    let raf = 0;
    let scrolled = false;
    const timer = window.setTimeout(
      () => dispatch({ type: "TIMEOUT" }),
      TARGET_TIMEOUT_MS,
    );
    const tick = () => {
      const el = document.querySelector<HTMLElement>(selector);
      if (el) {
        if (!scrolled) {
          scrolled = true;
          el.scrollIntoView?.({ block: "center", behavior: "smooth" });
        }
        const r = el.getBoundingClientRect();
        dispatch({
          type: "SEEN",
          rect: { top: r.top, left: r.left, width: r.width, height: r.height },
        });
      } else {
        dispatch({ type: "LOST" });
      }
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(timer);
    };
  }, [selector]);

  return state;
}
