import { type Ref } from "react";
import { Avatar } from "@/components/board/avatar";
import { ActivityIcon, describeChange } from "../../shared/activity-visual";
import { CommentComposer } from "../../shared/comment-composer";
import type { PageProps } from "../../page-props";

/** A dense log: one line per change, comments inline. Newest first. */
export function ConsoleLog({
  task,
  viewer,
  dispatch,
  composerRef,
}: PageProps & { composerRef: Ref<HTMLDivElement> }) {
  return (
    <section aria-label="Activity">
      <h2 className="mb-2 flex items-baseline gap-2 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
        Activity
        <span className="font-mono font-normal normal-case">
          {task.activity.length}
        </span>
      </h2>
      <div ref={composerRef} className="mb-3">
        <CommentComposer
          dispatch={dispatch}
          author={viewer.person}
          placeholder="Comment. Press C to focus, ⌘↵ to send."
        />
      </div>
      <ol className="divide-y divide-border/60 rounded-xl border border-border bg-card">
        {task.activity.map((e) => (
          <li
            key={e.id}
            className="flex items-start gap-3 px-3 py-2 text-[13px]"
          >
            <span className="w-14 shrink-0 pt-px font-mono text-[11px] text-muted-foreground">
              {e.at.replace(" ago", "")}
            </span>
            {e.kind === "comment" ? (
              <Avatar person={e.actor} size={18} />
            ) : (
              <span className="grid size-[18px] shrink-0 place-items-center text-muted-foreground">
                <ActivityIcon kind={e.kind} className="size-3.5" />
              </span>
            )}
            <p className="min-w-0 flex-1">
              <b className="font-medium">{e.actor.name.split(" ")[0]}</b>{" "}
              {e.kind === "comment" ? (
                <span className="text-foreground/85">{e.body}</span>
              ) : (
                <span className="text-muted-foreground">
                  {describeChange(e)}
                </span>
              )}
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}
