import { cn } from "@/lib/cn";

type StatusLinesProps = {
  /** Changes when the line changes, so it fades in again. */
  stepKey: string;
  line: string;
  reassure: boolean;
  reassureLine: string;
  className?: string;
};

/** A status line plus a reserved slot for the reassuring line. */
export function StatusLines({
  stepKey,
  line,
  reassure,
  reassureLine,
  className,
}: StatusLinesProps) {
  return (
    <div
      aria-live="polite"
      className={cn(
        "flex w-full max-w-xs flex-col items-center gap-1",
        className,
      )}
    >
      <p key={stepKey} className="ld-enter text-base text-foreground/80">
        {line}
      </p>
      <p
        className={cn(
          "min-h-5 text-sm text-muted-foreground transition-opacity duration-300 ease-out motion-reduce:transition-none",
          reassure ? "opacity-100" : "opacity-0",
        )}
      >
        {reassureLine}
      </p>
    </div>
  );
}
