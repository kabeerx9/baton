import { CalendarIcon, GitPullRequestIcon } from "lucide-react";
import { Avatar } from "@/components/board/avatar";
import { StatusIcon } from "@/components/board/status-icon";
import { STAGE_LABEL } from "../../copy";
import type { PageProps } from "../../page-props";
import { ChoiceMenu } from "../../shared/choice-menu";
import { PriorityBars } from "../../shared/priority-bars";
import { ASSIGNABLE } from "../../shared/people-list";
import { PRIORITY_LABEL } from "../../tone";
import type { Priority, Status } from "../../types";

const row =
  "flex min-h-9 w-full items-center justify-between gap-3 rounded-lg px-2 text-sm transition-colors duration-150 hover:bg-accent/60";
const btn =
  "flex w-full items-center justify-end gap-2 rounded-md py-1 text-right outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.98]";

const STATUSES: Status[] = ["todo", "doing", "review", "done"];
const PRIORITIES: Priority[] = ["none", "low", "medium", "high", "urgent"];

const DUE_TONE = {
  ok: "text-foreground",
  soon: "text-amber-600 dark:text-amber-400",
  overdue: "text-due-overdue",
} as const;

export function HandoffProperties({ task, view, viewer, dispatch }: PageProps) {
  const status = view.status;
  return (
    <aside
      aria-label="Properties"
      className="self-start rounded-2xl border border-border bg-card p-1.5"
    >
      <div className={row}>
        <span className="text-muted-foreground">Status</span>
        <ChoiceMenu
          align="end"
          value={status ?? ""}
          choices={STATUSES.map((s) => ({
            value: s,
            label: (
              <span className="flex items-center gap-2">
                <StatusIcon status={s} size={13} />
                {STAGE_LABEL[s]}
              </span>
            ),
          }))}
          onChange={(v) =>
            dispatch({ type: "set-status", to: v as Status, viewer })
          }
          trigger={
            <button type="button" className={btn}>
              {status ? (
                <>
                  <StatusIcon status={status} size={13} />
                  {STAGE_LABEL[status]}
                </>
              ) : (
                "Unknown"
              )}
            </button>
          }
        />
      </div>
      <div className={row}>
        <span className="text-muted-foreground">Priority</span>
        <ChoiceMenu
          align="end"
          value={task.priority}
          choices={PRIORITIES.map((p) => ({
            value: p,
            label: (
              <span className="flex items-center gap-2">
                <PriorityBars priority={p} />
                {PRIORITY_LABEL[p]}
              </span>
            ),
          }))}
          onChange={(v) =>
            dispatch({ type: "set-priority", priority: v as Priority })
          }
          trigger={
            <button type="button" className={btn}>
              <PriorityBars priority={task.priority} />
              {PRIORITY_LABEL[task.priority]}
            </button>
          }
        />
      </div>
      <div className={row}>
        <span className="text-muted-foreground">Owner</span>
        <ChoiceMenu
          align="end"
          value={task.assignee?.id ?? ""}
          choices={[
            { value: "", label: "Unassigned" },
            ...ASSIGNABLE.map((p) => ({
              value: p.id,
              label: (
                <span className="flex items-center gap-2">
                  <Avatar person={p} size={18} />
                  {p.name}
                </span>
              ),
            })),
          ]}
          onChange={(id) =>
            dispatch({
              type: "assign",
              person: ASSIGNABLE.find((p) => p.id === id) ?? null,
              viewer,
            })
          }
          trigger={
            <button type="button" className={btn}>
              <Avatar person={task.assignee} size={18} />
              {task.assignee?.name ?? "Unassigned"}
            </button>
          }
        />
      </div>
      <div className={row}>
        <span className="text-muted-foreground">Due</span>
        {task.due ? (
          <span
            className={`flex items-center gap-2 ${DUE_TONE[task.due.tone]}`}
          >
            <CalendarIcon className="size-3.5" aria-hidden="true" />
            {task.due.label}
          </span>
        ) : (
          <span className="text-muted-foreground">No date</span>
        )}
      </div>
      <div className={`${row} items-start py-2`}>
        <span className="pt-0.5 text-muted-foreground">Labels</span>
        <span className="flex flex-wrap justify-end gap-1">
          {task.labels.length === 0 ? (
            <span className="text-muted-foreground">None</span>
          ) : (
            task.labels.map((l) => (
              <span
                key={l}
                className="rounded-full bg-muted px-2 py-0.5 text-xs"
              >
                {l}
              </span>
            ))
          )}
        </span>
      </div>
      {task.pullRequest && (
        <div className="mx-1 mt-1 mb-1 rounded-xl bg-muted/60 p-2.5 text-sm">
          <p className="flex items-center gap-2 font-medium">
            <GitPullRequestIcon
              className="size-4 text-emerald-500"
              aria-hidden="true"
            />
            #{task.pullRequest.number}
            <span
              className={`ml-auto inline-flex items-center gap-1 text-xs font-normal ${task.pullRequest.checks === "passing" ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`}
            >
              <span className="size-1.5 rounded-full bg-current" />
              checks {task.pullRequest.checks}
            </span>
          </p>
          <p className="mt-1 truncate text-xs text-muted-foreground">
            {task.pullRequest.title}
          </p>
        </div>
      )}
    </aside>
  );
}
