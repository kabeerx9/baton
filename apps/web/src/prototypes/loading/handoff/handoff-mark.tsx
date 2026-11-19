import { cn } from "@/lib/cn";

const BASE_WIDTH = 88;
const BASE_HEIGHT = 14;

type HandoffMarkProps = {
  /** Scales the whole mark and its layout box. 1 is 88 x 14 px. */
  scale?: number;
  className?: string;
};

/**
 * Two people and a baton. The baton rests by one, passes to the other, and
 * the receiver gives a soft ring. Transform and opacity only.
 */
export function HandoffMark({ scale = 1, className }: HandoffMarkProps) {
  const node =
    "absolute top-1/2 size-3.5 -translate-y-1/2 rounded-full border-[1.5px] border-foreground/70";
  return (
    <div
      aria-hidden="true"
      className={cn("relative", className)}
      style={{ width: BASE_WIDTH * scale, height: BASE_HEIGHT * scale }}
    >
      <div
        className="absolute left-0 top-0 origin-top-left"
        style={{
          width: BASE_WIDTH,
          height: BASE_HEIGHT,
          transform: `scale(${scale})`,
          ["--ld-travel" as string]: "36px",
        }}
      >
        <span className="absolute inset-x-3.5 top-1/2 h-px -translate-y-1/2 bg-border" />
        <span className={cn(node, "left-0")}>
          <span
            className="ld-receive absolute -inset-px rounded-full border border-foreground/60"
            data-side="left"
          />
        </span>
        <span className={cn(node, "right-0")}>
          <span
            className="ld-receive absolute -inset-px rounded-full border border-foreground/60"
            data-side="right"
          />
        </span>
        <span className="ld-baton absolute left-[18px] top-1/2 h-[7px] w-5 -translate-y-1/2 rounded-full bg-foreground" />
      </div>
    </div>
  );
}
