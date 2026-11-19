import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { WORKSPACE_NAME } from "./copy";

type ErrorSlotProps = {
  where: "screen" | "region";
  onRetry: () => void;
};

/** Marks where the real error state takes over after a failed load. */
export function ErrorSlot({ where, onRetry }: ErrorSlotProps) {
  return (
    <div
      className={cn(
        "ld-enter flex h-full flex-col items-center justify-center gap-3 px-6 text-center",
        where === "screen" && "bg-background",
      )}
      role="alert"
    >
      <div className="flex max-w-xs flex-col items-center gap-3 rounded-xl border border-dashed border-border px-6 py-8">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Error state takes over here
        </p>
        <h2 className="text-base font-semibold">
          Could not open {WORKSPACE_NAME}
        </h2>
        <p className="text-sm text-muted-foreground">
          The loading UI has left. The real error screen replaces this box.
        </p>
        <Button size="sm" variant="outline" onClick={onRetry}>
          Try again
        </Button>
      </div>
    </div>
  );
}
