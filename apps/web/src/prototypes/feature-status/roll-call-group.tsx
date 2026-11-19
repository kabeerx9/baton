import { ChevronDownIcon } from "lucide-react";
import type { ReactNode } from "react";
import {
  Collapsible,
  CollapsiblePanel,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

const HEADING =
  "flex w-full items-center gap-2 px-3.5 py-2 font-semibold text-[11px] text-muted-foreground uppercase tracking-wider";

/**
 * A titled group of rows. A group that can fold (finished work) is a
 * collapsible whose trigger is the heading.
 */
export function RollCallGroup({
  title,
  count,
  tone = "text-muted-foreground",
  foldable = false,
  defaultOpen = true,
  children,
}: {
  title: string;
  count: number;
  tone?: string;
  foldable?: boolean;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  if (count === 0) return null;
  const heading = (
    <>
      <span className={tone}>{title}</span>
      <span className="font-normal tabular-nums">{count}</span>
    </>
  );
  if (!foldable)
    return (
      <section className="border-t first:border-t-0">
        <h2 className={HEADING}>{heading}</h2>
        <ul className="flex flex-col">{children}</ul>
      </section>
    );
  return (
    <Collapsible
      defaultOpen={defaultOpen}
      className="border-t first:border-t-0"
    >
      <CollapsibleTrigger
        className={`group ${HEADING} outline-none transition-colors duration-150 ease-out hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring`}
      >
        {heading}
        <ChevronDownIcon
          aria-hidden="true"
          className="ml-auto size-3.5 transition-transform duration-200 ease-out group-data-open:rotate-180 motion-reduce:transition-none"
        />
      </CollapsibleTrigger>
      <CollapsiblePanel>
        <ul className="flex flex-col">{children}</ul>
      </CollapsiblePanel>
    </Collapsible>
  );
}
