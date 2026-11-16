import { CalendarIcon, TagIcon } from "lucide-react";
import { Avatar } from "@/components/board/avatar";
import { StatusIcon } from "@/components/board/status-icon";
import { STAGE_LABEL } from "../../copy";
import type { PageProps } from "../../page-props";
import { ChoiceMenu } from "../../shared/choice-menu";
import { PriorityBars } from "../../shared/priority-bars";
import { ASSIGNABLE } from "../../shared/people-list";
import { PRIORITY_LABEL } from "../../tone";
import type { Priority, Status } from "../../types";
import { ChipFace, chipClass } from "./property-chip";

const STATUSES: Status[] = ["todo", "doing", "review", "done"];
const PRIORITIES: Priority[] = ["none", "low", "medium", "high", "urgent"];

/** Every property on one line. Each chip opens a menu; the letter is the shortcut. */
export function PropertyBar({ task, view, viewer, dispatch }: PageProps) {
  const status = view.status;
  return (
    <div
      className="flex flex-wrap items-center gap-2"
      role="group"
      aria-label="Properties"
    >
      <ChoiceMenu
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
          <button type="button" className={chipClass}>
            <ChipFace keys="s">
              {status ? <StatusIcon status={status} size={13} /> : null}
              {status ? STAGE_LABEL[status] : "Unknown"}
            </ChipFace>
          </button>
        }
      />
      <ChoiceMenu
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
          <button type="button" className={chipClass}>
            <ChipFace keys="p">
              <PriorityBars priority={task.priority} />
              {PRIORITY_LABEL[task.priority]}
            </ChipFace>
          </button>
        }
      />
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
          <button type="button" className={chipClass}>
            <ChipFace keys="a">
              <Avatar person={task.assignee} size={18} />
              {task.assignee?.name ?? "Unassigned"}
            </ChipFace>
          </button>
        }
      />
      <span className={`${chipClass} cursor-default hover:bg-card`}>
        <CalendarIcon
          className="size-3.5 text-muted-foreground"
          aria-hidden="true"
        />
        <span
          className={
            task.due?.tone === "soon"
              ? "text-amber-600 dark:text-amber-400"
              : task.due
                ? ""
                : "text-muted-foreground"
          }
        >
          {task.due?.label ?? "No date"}
        </span>
      </span>
      {task.labels.map((l) => (
        <span key={l} className={`${chipClass} cursor-default hover:bg-card`}>
          <TagIcon
            className="size-3 text-muted-foreground"
            aria-hidden="true"
          />
          {l}
        </span>
      ))}
    </div>
  );
}
