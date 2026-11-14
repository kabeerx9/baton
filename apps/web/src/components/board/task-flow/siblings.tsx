import { Link } from "@tanstack/react-router";
import { Avatar } from "../avatar";
import { StatusIcon } from "../status-icon";
import type { LinkedTask } from "./linked";

/** The other pieces of the same task, so you can move between them. */
export function Siblings({
  parent,
  items,
  currentId,
  workspaceId,
}: {
  /** The board task these belong to. */
  parent: LinkedTask | null;
  items: LinkedTask[];
  currentId: string;
  workspaceId: string;
}) {
  const done = items.filter((t) => t.status === "done").length;
  return (
    <aside>
      <p className="text-[11px] text-muted-foreground">Part of</p>
      {parent && (
        <Link
          to="/dashboard/workspace/$workspaceId/project/$projectId/task/$taskId"
          params={{
            workspaceId,
            projectId: parent.projectId,
            taskId: parent.id,
          }}
          className="mt-0.5 block font-medium text-sm hover:underline"
        >
          <span className="font-mono text-muted-foreground text-xs">
            {parent.key}
          </span>{" "}
          {parent.title}
        </Link>
      )}
      <p className="mt-1 text-muted-foreground text-xs tabular-nums">
        {done} of {items.length} done
      </p>
      <ul className="mt-3 flex flex-col gap-0.5">
        {items.map((task) => {
          const current = task.id === currentId;
          return (
            <li key={task.id}>
              <Link
                to="/dashboard/workspace/$workspaceId/project/$projectId/task/$taskId"
                params={{
                  workspaceId,
                  projectId: task.projectId,
                  taskId: task.id,
                }}
                aria-current={current ? "page" : undefined}
                className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-xs outline-none transition-colors duration-150 ease-out focus-visible:ring-2 focus-visible:ring-ring ${
                  current
                    ? "bg-accent text-foreground"
                    : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
                }`}
              >
                <StatusIcon
                  status={task.status}
                  blocked={task.blocked}
                  size={12}
                />
                <span className="min-w-0 flex-1 truncate">{task.title}</span>
                <Avatar person={task.owner} size={14} />
              </Link>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
