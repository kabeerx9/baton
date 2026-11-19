import { StatusIcon } from "@/components/board/status-icon";
import type { LinkedTask } from "@/components/board/task-flow/linked";

/** Features on one side of this one, as nodes in a labelled row. */
export function LaneLinkRow({
  label,
  items,
  open,
}: {
  label: string;
  items: LinkedTask[];
  /** The features hold this one up, so they read as unfinished work. */
  open: boolean;
}) {
  if (items.length === 0) return null;
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <ul className="flex min-w-0 flex-wrap gap-1.5">
        {items.map((x) => (
          <li
            key={x.id}
            title={x.title}
            className={`flex max-w-full items-center gap-1.5 rounded-lg border bg-card px-2 py-1 ${
              open ? "border-amber-500/60" : "border-border"
            }`}
          >
            <StatusIcon status={x.status} size={12} />
            <span className="font-mono text-[10px] text-muted-foreground">
              {x.key}
            </span>
            <span className="truncate">{x.title}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
