import { StatusIcon } from "@/components/board/status-icon";
import type { LinkedTask } from "@/components/board/task-flow/linked";

export function Chip({ item, open }: { item: LinkedTask; open: boolean }) {
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
