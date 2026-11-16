import { CalendarIcon, GitPullRequestIcon } from "lucide-react";
import { Avatar } from "@/components/board/avatar";
import { StatusIcon } from "@/components/board/status-icon";
import type { PageProps } from "../../page-props";
import { ChoiceMenu } from "../../shared/choice-menu";
import { DescriptionBlock } from "../../shared/description-block";
import { PriorityBars } from "../../shared/priority-bars";
import { ASSIGNABLE } from "../../shared/people-list";
import { PRIORITY_LABEL } from "../../tone";
import type { Priority } from "../../types";

const PRIORITIES: Priority[] = ["none", "low", "medium", "high", "urgent"];
const h =
  "mb-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase";

/** The side column: the brief, the people, and the facts. */
export function PulseRail(props: PageProps) {
  const { task, dispatch, viewer } = props;
  const related = [...task.related];
  return (
    <aside
      className="space-y-7 lg:sticky lg:top-6 lg:self-start"
      aria-label="Details"
    >
      <section>
        <h2 className={h}>The brief</h2>
        <DescriptionBlock task={task} />
      </section>
      <section>
        <h2 className={h}>People</h2>
        <ul className="space-y-2 text-sm">
          <li className="flex items-center gap-2.5">
            <Avatar person={task.creator} size={24} />
            <span className="flex-1">{task.creator.name}</span>
            <span className="text-xs text-muted-foreground">Creator</span>
          </li>
          <li className="flex items-center gap-2.5">
            <ChoiceMenu
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
                <button
                  type="button"
                  className="flex flex-1 items-center gap-2.5 rounded-lg py-0.5 text-left outline-none transition-colors hover:bg-accent/60 focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.99]"
                >
                  <Avatar person={task.assignee} size={24} />
                  <span className="flex-1">
                    {task.assignee?.name ?? "Unassigned"}
                  </span>
                  <span className="text-xs text-muted-foreground">Owner</span>
                </button>
              }
            />
          </li>
        </ul>
      </section>
      <section>
        <h2 className={h}>Facts</h2>
        <dl className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">Priority</dt>
            <dd>
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
                  <button
                    type="button"
                    className="flex items-center gap-2 rounded-md px-1 py-0.5 outline-none hover:bg-accent/60 focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.98]"
                  >
                    <PriorityBars priority={task.priority} />
                    {PRIORITY_LABEL[task.priority]}
                  </button>
                }
              />
            </dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">Due</dt>
            <dd className="flex items-center gap-1.5">
              {task.due ? (
                <>
                  <CalendarIcon className="size-3.5" aria-hidden="true" />
                  {task.due.label}
                </>
              ) : (
                <span className="text-muted-foreground">No date</span>
              )}
            </dd>
          </div>
          <div className="flex items-start justify-between gap-3">
            <dt className="text-muted-foreground">Labels</dt>
            <dd className="flex flex-wrap justify-end gap-1">
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
            </dd>
          </div>
        </dl>
      </section>
      {task.pullRequest && (
        <section>
          <h2 className={h}>Pull request</h2>
          <div className="rounded-xl border border-border bg-card p-3 text-sm">
            <p className="flex items-center gap-2 font-medium">
              <GitPullRequestIcon
                className="size-4 text-emerald-500"
                aria-hidden="true"
              />
              #{task.pullRequest.number}
              <span className="ml-auto text-xs font-normal text-emerald-600 dark:text-emerald-400">
                checks {task.pullRequest.checks}
              </span>
            </p>
            <p className="mt-1 truncate text-xs text-muted-foreground">
              {task.pullRequest.branch}
            </p>
          </div>
        </section>
      )}
      {related.length > 0 && (
        <section>
          <h2 className={h}>Related</h2>
          <ul className="space-y-1.5 text-sm">
            {related.map((r) => (
              <li key={r.key} className="flex items-center gap-2">
                <StatusIcon status={r.status} size={13} />
                <span className="font-mono text-xs text-muted-foreground">
                  {r.key}
                </span>
                <span className="truncate">{r.title}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </aside>
  );
}
