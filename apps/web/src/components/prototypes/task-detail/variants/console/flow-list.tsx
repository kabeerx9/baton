import { ArrowDownIcon } from "lucide-react";
import { Avatar } from "@/components/board/avatar";
import { StatusIcon } from "@/components/board/status-icon";
import type { PageProps } from "../../page-props";
import { STAGE_LABEL } from "../../copy";
import { TONE_CLASS, toneOf } from "../../tone";
import type { Linked } from "../../types";

function Row({ item, hot }: { item: Linked; hot: boolean }) {
  return (
    <li>
      <button
        type="button"
        className={`flex w-full items-center gap-2 rounded-lg border px-2.5 py-2 text-[13px] outline-none transition-[border-color,background-color,scale] duration-150 hover:bg-accent/60 focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.98] ${hot ? "border-amber-500/40 bg-amber-500/5" : "border-border"}`}
      >
        <StatusIcon status={item.status} size={13} />
        <span className="font-mono text-[11px] text-muted-foreground">
          {item.key}
        </span>
        <span className="min-w-0 flex-1 truncate">{item.title}</span>
        <Avatar person={item.owner} size={18} />
      </button>
      <p className="mt-0.5 pl-2 text-[11px] text-muted-foreground">
        {STAGE_LABEL[item.status]} · {item.since}
      </p>
    </li>
  );
}

/** The chain in one column: what holds this up, this task, what waits on it. */
export function FlowList({ task, view }: PageProps) {
  const tone = TONE_CLASS[toneOf(view.state)];
  const coreDone = view.state.kind === "done";
  return (
    <div className="space-y-2">
      <p className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
        Waits on · {task.waitsOn.length}
      </p>
      {task.waitsOn.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-3 py-3 text-xs text-muted-foreground">
          Nothing in the way.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {task.waitsOn.map((t) => (
            <Row key={t.key} item={t} hot={t.status !== "done"} />
          ))}
        </ul>
      )}
      <div className="flex items-center gap-2 py-1 text-muted-foreground">
        <ArrowDownIcon className="size-3.5" aria-hidden="true" />
        <span
          className={`inline-flex items-center gap-2 rounded-md px-2 py-1 text-xs font-medium ${tone.soft}`}
        >
          <span className={`size-1.5 rounded-full ${tone.dot}`} />
          {task.key}
        </span>
        <ArrowDownIcon className="size-3.5" aria-hidden="true" />
      </div>
      <p className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
        Waited on by · {task.blocks.length}
      </p>
      {task.blocks.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-3 py-3 text-xs text-muted-foreground">
          Nobody waits on this.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {task.blocks.map((t) => (
            <Row key={t.key} item={t} hot={false} />
          ))}
        </ul>
      )}
      {coreDone && task.blocks.some((t) => t.status !== "done") && (
        <p className="text-xs text-emerald-600 dark:text-emerald-400">
          They were told they can continue.
        </p>
      )}
    </div>
  );
}
