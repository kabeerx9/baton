import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/cn";
import { useBonePhase } from "./bone-context";

type BoneProps = {
  /** Sizes the box. The same box holds the skeleton and the real content. */
  className: string;
  children?: ReactNode;
};

/**
 * One box, two states. Skeleton and content share the same class, so nothing
 * moves when data arrives. Skeletons stay out until the delay has passed.
 */
export function Bone({ className, children }: BoneProps) {
  const phase = useBonePhase();
  const showBone = phase === "bones" || phase === "handoff";
  const showText = phase !== "bones";

  return (
    <div className={cn("relative", className)}>
      {showText ? (
        <div
          className={cn(
            "size-full",
            phase === "handoff" || phase === "reveal" ? "ld-text-enter" : "",
          )}
        >
          {children}
        </div>
      ) : null}
      {showBone ? (
        <div
          aria-hidden="true"
          className={cn(
            "ld-bone-box absolute inset-0",
            phase === "handoff" && "ld-bone-leave",
          )}
        >
          <Skeleton className="size-full rounded-[inherit]" />
        </div>
      ) : null}
    </div>
  );
}
