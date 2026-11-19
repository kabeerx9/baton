import { Avatar } from "@/components/board/avatar";
import { STATUS_LABEL } from "@/components/board/model";
import type { LinkedTask } from "@/components/board/task-flow/linked";
import { StatusIcon } from "@/components/board/status-icon";

function LinkedRow({ item, verb }: { item: LinkedTask; verb: string }) {
  return (
    <li className="flex items-center gap-3 px-3.5 py-2.5 text-sm">
      <StatusIcon status={item.status} size={16} />
      <span className="min-w-0 flex-1">
        <span className="block text-muted-foreground text-xs">
          {verb} · {STATUS_LABEL[item.status]}
        </span>
        <span className="flex min-w-0 items-baseline gap-2">
          <span className="shrink-0 font-mono text-muted-foreground text-xs">
            {item.key}
          </span>
          <span className="truncate font-medium">{item.title}</span>
        </span>
      </span>
      <Avatar person={item.owner} size={22} />
    </li>
  );
}

/** Links to other features, as rows that match the task rows. */
export function LinkedRows({
  waitsOn,
  blocks,
}: {
  waitsOn: LinkedTask[];
  blocks: LinkedTask[];
}) {
  return (
    <>
      {waitsOn.map((x) => (
        <LinkedRow key={x.id} item={x} verb="Waits on" />
      ))}
      {blocks.map((x) => (
        <LinkedRow key={x.id} item={x} verb="Holds up" />
      ))}
    </>
  );
}
