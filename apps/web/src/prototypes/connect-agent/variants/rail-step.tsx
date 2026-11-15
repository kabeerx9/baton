import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type RailStepProps = {
  index: number;
  title: string;
  last: boolean;
  done?: boolean;
  doneIcon?: ReactNode;
  children?: ReactNode;
};

export function RailStep({
  index,
  title,
  last,
  done,
  doneIcon,
  children,
}: RailStepProps) {
  return (
    <li className={cn("relative ps-11", last ? "pb-0" : "pb-7")}>
      {last ? null : (
        <span
          aria-hidden="true"
          className="absolute start-3 top-7 bottom-1 w-px bg-border"
        />
      )}
      <span
        aria-hidden="true"
        className={cn(
          "absolute start-0 top-0 flex size-6 items-center justify-center rounded-full border text-xs font-medium tabular-nums transition-colors duration-200",
          done
            ? "border-success/40 bg-success/10 text-success-foreground [&_svg]:size-3.5"
            : "border-border bg-background text-muted-foreground",
        )}
      >
        {done ? doneIcon : index}
      </span>
      <div className="space-y-2.5">
        <h2 className="text-sm leading-6 font-medium">{title}</h2>
        {children}
      </div>
    </li>
  );
}
