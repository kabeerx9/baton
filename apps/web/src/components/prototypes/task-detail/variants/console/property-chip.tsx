import type { ReactNode } from "react";
import { KeyHint } from "./key-hint";

export const chipClass =
  "group inline-flex h-8 items-center gap-2 rounded-lg border border-border bg-card px-2.5 text-[13px] outline-none transition-[border-color,background-color,scale] duration-150 ease-out hover:border-foreground/25 hover:bg-accent/60 focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.97]";

/** A property as a chip: value, then its key. */
export function ChipFace({
  keys,
  children,
}: {
  keys?: string;
  children: ReactNode;
}) {
  return (
    <>
      {children}
      {keys && (
        <span className="opacity-60 transition-opacity group-hover:opacity-100">
          <KeyHint keys={keys} />
        </span>
      )}
    </>
  );
}
