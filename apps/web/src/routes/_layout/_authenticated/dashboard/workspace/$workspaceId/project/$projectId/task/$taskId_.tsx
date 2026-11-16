import { TaskDetailPage } from "@/components/task/detail/task-detail-page";
import { TaskShortcuts } from "@/components/task/task-shortcuts";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import TaskLayout from "@/components/common/task-layout";
import PageTitle from "@/components/page-title";
import TaskDeleteDialog from "@/components/task/task-delete-dialog";
import { TaskHeaderActions } from "@/components/task/header/task-header-actions";
import { TaskDetailsSkeleton } from "@/components/task/task-page-skeleton";
import { AlertDialogCreateHandle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import useGetActivitiesByTaskId from "@/hooks/queries/activity/use-get-activities-by-task-id";
import useGetProject from "@/hooks/queries/project/use-get-project";
import useGetTask from "@/hooks/queries/task/use-get-task";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/workspace/$workspaceId/project/$projectId/task/$taskId_",
)({
  // `addTasks` opens the Add task dialog once, for a task that was just created.
  validateSearch: (search: Record<string, unknown>): { addTasks?: true } =>
    search.addTasks === true || search.addTasks === "true"
      ? { addTasks: true }
      : {},
  component: RouteComponent,
});

function RouteComponent() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { projectId, workspaceId, taskId } = Route.useParams();
  const { addTasks } = Route.useSearch();
  const {
    data: task,
    isLoading: isTaskLoading,
    isError: isTaskError,
  } = useGetTask(taskId);
  const { data: project, isLoading: isProjectLoading } = useGetProject({
    id: projectId,
    workspaceId,
  });
  const { isLoading: isActivitiesLoading } = useGetActivitiesByTaskId(taskId);
  const [isShikiReady, setIsShikiReady] = useState(false);
  const [deleteHandle] = useState(() => AlertDialogCreateHandle());
  useEffect(() => {
    let mounted = true;

    void import("@/lib/shiki-highlighter")
      .then(({ getSharedShikiHighlighter }) => getSharedShikiHighlighter())
      .then(() => {
        if (!mounted) return;
        setIsShikiReady(true);
      })
      .catch((err) => {
        console.error("Failed to initialize Shiki highlighter:", err);
        if (!mounted) return;
        // Render the task view without syntax highlighting rather than
        // leaving the page stuck in a permanent loading state.
        setIsShikiReady(true);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const isLoading =
    isTaskLoading || isProjectLoading || isActivitiesLoading || !isShikiReady;

  const handleDeleted = () => {
    navigate({
      to: "/dashboard/workspace/$workspaceId/board",
      params: { workspaceId },
      replace: true,
    });
  };

  return (
    <TaskLayout
      taskId={taskId}
      projectId={projectId}
      workspaceId={workspaceId}
      headerActions={
        !isLoading && task ? (
          <TaskHeaderActions
            taskId={taskId}
            projectId={projectId}
            workspaceId={workspaceId}
            deleteHandle={deleteHandle}
          />
        ) : null
      }
    >
      <PageTitle
        title={
          isLoading
            ? t("tasks:common.loadingTask")
            : isTaskError || !task
              ? t("tasks:common.taskNotFound")
              : project
                ? `${project.slug}-${task.number} ${task.title}`
                : undefined
        }
      />
      {!isLoading && task && (
        <TaskShortcuts
          taskId={taskId}
          projectId={projectId}
          workspaceId={workspaceId}
        />
      )}
      {!isLoading && task && (
        <TaskDeleteDialog
          handle={deleteHandle}
          taskId={taskId}
          onDeleted={handleDeleted}
        />
      )}
      {isLoading ? (
        <TaskDetailsSkeleton />
      ) : isTaskError || !task ? (
        <div className="flex h-full flex-col items-center justify-center gap-4 px-4 py-12 text-center">
          <h1 className="text-2xl font-bold">
            {t("tasks:common.taskNotFound")}
          </h1>
          <p className="text-muted-foreground max-w-md">
            {t("tasks:common.taskNotFoundDescription", {
              defaultValue:
                "The task you are looking for does not exist or has been deleted.",
            })}
          </p>
          <Button
            variant="outline"
            onClick={() =>
              navigate({
                to: "/dashboard/workspace/$workspaceId/board",
                params: { workspaceId },
              })
            }
          >
            {t("navigation:sidebar.backToBoard", {
              defaultValue: "Back to board",
            })}
          </Button>
        </div>
      ) : (
        <TaskDetailPage
          key={taskId}
          taskId={taskId}
          projectId={projectId}
          workspaceId={workspaceId}
          openAddTask={addTasks}
          onAddTaskOpened={() =>
            navigate({
              from: Route.fullPath,
              search: {},
              replace: true,
              resetScroll: false,
            })
          }
        />
      )}
    </TaskLayout>
  );
}
