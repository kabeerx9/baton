import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useBoardProjectId } from "@/hooks/queries/board/use-board-project-id";
import type { AssignedTask } from "@/fetchers/task/get-assigned-tasks";
import { getColumnIcon } from "@/lib/column";
import { getStatusDisplayLabel } from "@/lib/i18n/domain";
import { resolveLabelColor } from "@/lib/label-color";
import { getPriorityIcon } from "@/lib/priority";
import { blockedBadge } from "./blocked-badge";
import { DueDateText } from "./due-date-text";
import { repoLabel } from "./repo-label";

type AssignedTaskRowProps = {
  task: AssignedTask;
  workspaceId: string;
  showLabels?: boolean;
};

export function AssignedTaskRow({
  task,
  workspaceId,
  showLabels = false,
}: AssignedTaskRowProps) {
  const { t } = useTranslation();
  const boardProjectId = useBoardProjectId(workspaceId);
  const badge = blockedBadge(task);
  const badgeText = badge
    ? [
        badge.firstKey
          ? t("workspace:myTasks.waitsOn", { key: badge.firstKey })
          : t("workspace:myTasks.waitsOnHidden", { count: badge.hidden }),
        badge.more > 0
          ? t("workspace:myTasks.waitsOnMore", { count: badge.more })
          : null,
      ]
        .filter(Boolean)
        .join(" ")
    : null;
  return (
    <Link
      to="/dashboard/workspace/$workspaceId/project/$projectId/task/$taskId"
      params={{ workspaceId, projectId: task.projectId, taskId: task.id }}
      className="flex h-11 items-center gap-2.5 border-border/50 border-b px-1 outline-none transition-colors hover:bg-accent/50 focus-visible:bg-accent/50"
    >
      <span className="flex w-4 shrink-0 justify-center [&_svg]:size-3.5">
        {getPriorityIcon(task.priority)}
      </span>
      <span
        className="shrink-0"
        title={getStatusDisplayLabel(task.status, task.statusName ?? undefined)}
      >
        {getColumnIcon(task.status, false, task.statusIcon)}
      </span>
      <span className="hidden w-16 shrink-0 truncate font-medium text-muted-foreground text-xs sm:block">
        {task.number == null
          ? task.projectSlug
          : `${task.projectSlug}-${task.number}`}
      </span>
      <span className="min-w-0 flex-1 truncate text-foreground text-sm">
        {task.title}
      </span>
      {badge && badgeText && (
        <span
          className="shrink-0 rounded-md bg-amber-500/10 px-1.5 py-0.5 font-medium text-[11px] text-amber-700 dark:text-amber-400"
          title={[
            ...badge.titles,
            badge.hidden > 0
              ? t("workspace:myTasks.waitsOnHidden", { count: badge.hidden })
              : null,
          ]
            .filter(Boolean)
            .join("\n")}
        >
          {badgeText}
        </span>
      )}
      {showLabels && task.labels.length > 0 && (
        <span className="hidden w-44 shrink-0 items-center gap-2.5 overflow-hidden lg:flex">
          {task.labels.slice(0, 2).map((label) => (
            <span
              key={label.id}
              className="flex min-w-0 items-center gap-1.5 text-muted-foreground text-xs"
            >
              <span
                aria-hidden="true"
                className="size-1.5 shrink-0 rounded-full"
                style={{ backgroundColor: resolveLabelColor(label.color) }}
              />
              <span className="truncate">{label.name}</span>
            </span>
          ))}
        </span>
      )}
      <span className="hidden w-28 shrink-0 truncate text-muted-foreground text-xs sm:block">
        {repoLabel(
          { id: task.projectId, name: task.projectName },
          boardProjectId,
          t("workspace:myTasks.noRepo"),
        )}
      </span>
      <DueDateText
        dueDate={task.dueDate}
        className="shrink-0 text-right sm:w-20"
      />
    </Link>
  );
}
