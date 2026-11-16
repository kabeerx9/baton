import { useEffect, useReducer, useRef } from "react";
import {
  TARGET_WAITING,
  type TargetState,
  targetReducer,
} from "./target-state";

/** How long to wait for a target to mount before centering the card. */
export const TARGET_TIMEOUT_MS = 2000;
/** A centered step on a new page waits this long for the page to settle. */
export const PAGE_SETTLE_MS = 600;

/** The element is on screen sideways too (an off-canvas sidebar is not). */
function visible(r: DOMRect) {
  return r.width > 0 && r.right > 0 && r.left < window.innerWidth;
}

/**
 * Follows one element on every frame, so layout shifts and scrolls track.
 * A new `pageKey` forgets the old target (the page is changing); a new
 * selector on the same page keeps it, so the hole can glide to the next one.
 */
export function useTarget(
  selectors: readonly string[],
  pageKey: string,
): TargetState {
  const selector = selectors.length ? selectors.join("\n") : null;
  const [state, dispatch] = useReducer(
    targetReducer,
    selector ? TARGET_WAITING : { kind: "fallback" },
  );
  const lastPage = useRef(pageKey);

  useEffect(() => {
    const pageChanged = lastPage.current !== pageKey;
    lastPage.current = pageKey;
    if (pageChanged) dispatch({ type: "RESET" });

    if (!selector) {
      const timer = window.setTimeout(
        () => dispatch({ type: "CLEAR" }),
        pageChanged ? PAGE_SETTLE_MS : 0,
      );
      return () => window.clearTimeout(timer);
    }

    let raf = 0;
    let scrolledTo: HTMLElement | null = null;
    const timer = window.setTimeout(
      () => dispatch({ type: "TIMEOUT" }),
      TARGET_TIMEOUT_MS,
    );
    const tick = () => {
      let el: HTMLElement | null = null;
      for (const candidate of selectors) {
        const found = document.querySelector<HTMLElement>(candidate);
        if (found && visible(found.getBoundingClientRect())) {
          el = found;
          break;
        }
      }
      const r = el?.getBoundingClientRect();
      if (el && r && visible(r)) {
        if (scrolledTo !== el) {
          scrolledTo = el;
          el.scrollIntoView?.({ block: "center", behavior: "smooth" });
        }
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
    // `selector` is the stable key for `selectors`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selector, pageKey]);

  return state;
}
