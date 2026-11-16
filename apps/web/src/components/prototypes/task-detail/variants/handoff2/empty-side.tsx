import { CheckIcon } from "lucide-react";

/** An empty side shrinks to one calm line. It is not an empty box. */
export function EmptySide({
  heading,
  text,
}: {
  heading: string;
  text: string;
}) {
  return (
    <div className="relative w-full md:w-[190px]">
      <h2 className="mb-2 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase md:absolute md:-top-7 md:mb-0">
        {heading}
      </h2>
      <p className="flex items-center gap-2 rounded-full border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
        <CheckIcon className="size-3.5 shrink-0" aria-hidden="true" />
        {text}
      </p>
    </div>
  );
}
