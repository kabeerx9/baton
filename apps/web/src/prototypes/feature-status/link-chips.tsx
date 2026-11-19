import type { LinkedTask } from "@/components/board/task-flow/linked";
import { StatusIcon } from "@/components/board/status-icon";

function Chip({ item, open }: { item: LinkedTask; open: boolean }) {
  return (
    <li
      title={item.title}
      className={`flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs ${
        open ? "border-amber-500/40" : "border-border"
      }`}
    >
      <StatusIcon status={item.status} size={12} />
      <span className="font-mono text-muted-foreground">{item.key}</span>
      <span className="truncate">{item.title}</span>
    </li>
  );
}

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
