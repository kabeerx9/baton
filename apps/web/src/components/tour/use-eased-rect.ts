import { useEffect, useRef, useState } from "react";
import { easeRect, type Rect, sameRect } from "./rect";

/** Glides toward `target` each frame; jumps when motion is reduced. */
export function useEasedRect(target: Rect | null, reduced: boolean) {
  const [rect, setRect] = useState<Rect | null>(target);
  const current = useRef<Rect | null>(target);

  useEffect(() => {
    if (!target || reduced || !current.current) {
      current.current = target;
      setRect(target);
      return;
    }
    let raf = 0;
    const tick = () => {
      const from = current.current;
      if (!from) return;
      const next = easeRect(from, target);
      current.current = next;
      setRect(next);
      if (!sameRect(next, target)) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, reduced]);

  return rect;
}
