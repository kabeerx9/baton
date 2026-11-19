import type { LinkedTask } from "@/components/board/task-flow/linked";
import { Chip } from "./link-chip";

/** Features this one waits on, and features that wait on it, as one quiet row. */
export function LinkChips({
  waitsOn,
  blocks,
}: {
  waitsOn: LinkedTask[];
  blocks: LinkedTask[];
}) {
  if (waitsOn.length === 0 && blocks.length === 0) return null;
  return (
    <div className="flex flex-col gap-2 border-t pt-4 text-xs sm:flex-row sm:flex-wrap sm:gap-x-6">
      {waitsOn.length > 0 && (
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="text-muted-foreground">Waits on</span>
          <ul className="flex min-w-0 flex-wrap gap-1.5">
            {waitsOn.map((x) => (
              <Chip key={x.id} item={x} open={x.status !== "done"} />
            ))}
          </ul>
        </div>
      )}
      {blocks.length > 0 && (
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="text-muted-foreground">Holds up</span>
          <ul className="flex min-w-0 flex-wrap gap-1.5">
            {blocks.map((x) => (
              <Chip key={x.id} item={x} open={false} />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
