import { type ReactNode, useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";

/**
 * Follows its content's height with a transition, so the page below slides
 * instead of jumping when the content is swapped for a taller or shorter one.
 */
export function SmoothHeight({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const inner = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | null>(null);
  // The transition turns on after the first measure, so load does not animate.
  const [ready, setReady] = useState(false);

  useLayoutEffect(() => {
    const el = inner.current;
    if (!el) return;
    setHeight(el.offsetHeight);
    const observer = new ResizeObserver(() => setHeight(el.offsetHeight));
    observer.observe(el);
    const frame = requestAnimationFrame(() => setReady(true));
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div
      className={cn(
        ready &&
          "transition-[height] duration-250 ease-(--ease-out) motion-reduce:transition-none",
        className,
      )}
      style={{ height: height ?? undefined }}
    >
      <div className="relative" ref={inner}>
        {children}
      </div>
    </div>
  );
}
