import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Avatar } from "../avatar";
import { isBlocked, type Lane, laneOf, type Subtask } from "../model";
import { StatusMenu } from "../status-menu";
import { waitingNote } from "../waiting-note";

/** How many tasks must finish before this one can, counting through others. */
function depth(
  task: Subtask,
  byId: Map<string, Subtask>,
  seen = new Set<string>(),
): number {
  if (seen.has(task.id)) return 0;
  seen.add(task.id);
  let deepest = 0;
  for (const id of task.blockedBy) {
    const blocker = byId.get(id);
    if (blocker) deepest = Math.max(deepest, depth(blocker, byId, seen) + 1);
  }
  return deepest;
}

/**
 * A feature's tasks as a plain list, for screens too narrow for the map.
 * The order is the order of work: what can start now first, what waits last.
 */
export function TaskList({
  tasks,
  lanes,
  workspaceId,
}: {
  tasks: Subtask[];
  lanes: Lane[];
  workspaceId: string;
}) {
  const { t } = useTranslation();
  const byId = new Map(tasks.map((task) => [task.id, task]));
  const ordered = [...tasks].sort((a, b) => depth(a, byId) - depth(b, byId));

  return (
    <ul className="flex flex-col gap-2">
      {ordered.map((task) => {
        const blocked = isBlocked(task);
        const lane = laneOf(lanes, task.projectId);
        const note = waitingNote(task);
        return (
          <li
            key={task.id}
            className={`flex items-start gap-2 rounded-2xl border bg-card px-3 py-2.5 ${
              blocked ? "border-amber-500/50" : "border-border"
            }`}
          >
            <StatusMenu
              taskId={task.id}
              status={task.status}
              blocked={blocked}
            />
            <Link
              to="/dashboard/workspace/$workspaceId/project/$projectId/task/$taskId"
              params={{
                workspaceId,
                projectId: task.projectId,
                taskId: task.id,
              }}
              className="min-w-0 flex-1 rounded outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <p
                className={`text-sm leading-snug ${task.status === "done" ? "text-muted-foreground" : ""}`}
              >
                {task.title}
              </p>
              <p className="mt-1 flex flex-wrap gap-x-2 text-[11px] text-muted-foreground">
                <span className={lane?.tone.text}>{lane?.name ?? ""}</span>
                <span className="font-mono">{task.key}</span>
                {task.pr && (
                  <span>
                    #{task.pr.number} {task.pr.state}
                  </span>
                )}
                {note && (
                  <span className="text-amber-600 dark:text-amber-400">
                    {[
                      note.visible.length > 0
                        ? t("workspace:board.waiting.on", {
                            list: note.visible.join(", "),
                          })
                        : null,
                      note.hidden > 0
                        ? t("workspace:board.waiting.hidden", {
                            count: note.hidden,
                          })
                        : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                )}
              </p>
            </Link>
            <Avatar person={task.assignee} size={22} />
          </li>
        );
      })}
    </ul>
  );
}
