import { PencilLineIcon } from "lucide-react";
import type { TaskDetail } from "../types";

/** The brief. An empty one invites a first line instead of showing nothing. */
export function DescriptionBlock({ task }: { task: TaskDetail }) {
  if (task.description.length === 0) {
    return (
      <button
        type="button"
        className="flex w-full items-center gap-3 rounded-xl border border-dashed border-border px-4 py-4 text-left text-sm text-muted-foreground transition-colors duration-150 hover:border-foreground/25 hover:bg-accent/50 active:scale-[0.995]"
      >
        <span className="inline-flex size-8 items-center justify-center rounded-lg bg-muted">
          <PencilLineIcon className="size-4" aria-hidden="true" />
        </span>
        <span>
          <span className="block font-medium text-foreground">
            Add the brief
          </span>
          Say what done looks like, so the next person can pick this up.
        </span>
      </button>
    );
  }
  return (
    <div className="space-y-3 text-[15px] leading-relaxed text-foreground/90">
      {task.description.map((p) => (
        <p key={p}>{p}</p>
      ))}
    </div>
  );
}
