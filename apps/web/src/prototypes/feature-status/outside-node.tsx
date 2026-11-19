import type { Blocker } from "@/components/board/model";
import { NODE_BASE } from "./node-style";

/** A task from another feature that holds one of ours up. Dashed: not ours. */
export function OutsideNode({ blocker }: { blocker: Blocker }) {
  return (
    <li
      data-node={blocker.key}
      title={`${blocker.key} ${blocker.title}, in another feature`}
      className={`${NODE_BASE} border-dashed border-amber-500/70 px-2 text-[10px]`}
    >
      <span>{blocker.key}</span>
      <span className="truncate font-sans text-xs">{blocker.title}</span>
      {blocker.assigneeName && (
        <span className="shrink-0 font-sans text-muted-foreground text-xs">
          {blocker.assigneeName}
        </span>
      )}
    </li>
  );
}
