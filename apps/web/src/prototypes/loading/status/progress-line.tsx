import { cn } from "@/lib/cn";

/** A 2px hairline. A short segment travels along it. Transform only. */
export function ProgressLine({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn("h-0.5 w-full overflow-hidden bg-border", className)}
    >
      <div className="ld-line-segment h-full rounded-full bg-foreground/70" />
    </div>
  );
}
