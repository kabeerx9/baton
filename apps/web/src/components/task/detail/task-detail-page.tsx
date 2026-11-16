import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ExternalLinksAccordion } from "@/components/external-links/external-links-accordion";
import { AddSubtaskDialog } from "@/components/board/add-subtask-dialog";
import {
  buildBoard,
  effectiveStatus,
  findBoardItem,
  isBlocked,
  kindOf,
  toPerson,
  toStatus,
} from "@/components/board/model";
import {
  type LinkedTask,
  otherEnds,
  type RelatedTask,
} from "@/components/board/task-flow/linked";
import {
  pageBlocked,
  pageDone,
  waitingOnThis,
} from "@/components/board/task-flow/page-blocked";
import { Siblings } from "@/components/board/task-flow/siblings";
import { TaskStream } from "@/components/board/task-flow/task-stream";
import { WaitsOnSection } from "@/components/board/task-flow/waits-on-section";
import { TaskChangeRequest } from "@/components/task/change-request/task-change-request";
import { PropertyChips } from "@/components/task/properties/property-chips";
import { TaskActivity } from "@/components/task/task-activity";
import TaskDescription from "@/components/task/task-description";
import TaskRelations from "@/components/task/task-relations";
import TaskTitle from "@/components/task/task-title";
import useGetActivitiesByTaskId from "@/hooks/queries/activity/use-get-activities-by-task-id";
import { useGetBoard } from "@/hooks/queries/board/use-get-board";
import { useGetColumns } from "@/hooks/queries/column/use-get-columns";
import useExternalLinks from "@/hooks/queries/external-link/use-external-links";
import useGetTask from "@/hooks/queries/task/use-get-task";
import useGetTaskRelations from "@/hooks/queries/task-relation/use-get-task-relations";
import type { ExternalLink } from "@/types/external-link";
import { DiagramCore } from "./diagram/diagram-core";
import { TaskDiagram } from "./diagram/task-diagram";
import { deriveHeadline } from "./headline-model";
import { TaskHeadline } from "./task-headline";
import { heroTone } from "./hero-tone";
import { deriveStatusBar } from "./status-bar/status-bar-model";
import { TaskStatusBar } from "./status-bar/task-status-bar";
import { TaskHero } from "./task-hero";
import { getStatusDisplayLabel } from "@/lib/i18n/domain";

/**
 * The page for one task or feature. The hero answers "what state is this in,
 * what is it waiting on, who waits on it": a status bar over a dependency
 * diagram. Details, relations and activity sit below it.
 */
export function TaskDetailPage({
  taskId,
  projectId,
  workspaceId,
  openAddTask = false,
  onAddTaskOpened,
}: {
  taskId: string;
  projectId: string;
  workspaceId: string;
  /** Open the Add task dialog on arrival, for a task that was just created. */
  openAddTask?: boolean;
  /** Called once the request is taken, so the caller can drop it from the URL. */
  onAddTaskOpened?: () => void;
}) {
  const { t } = useTranslation();
  const { data: task } = useGetTask(taskId);
  const { data: relations = [] } = useGetTaskRelations(taskId);
  const { data: board } = useGetBoard(workspaceId);
  const columns = useGetColumns(projectId);
  const { isLoading: activitiesLoading } = useGetActivitiesByTaskId(taskId);
  const { data: externalLinks = [], isLoading: linksLoading } =
    useExternalLinks(taskId);
  const [adding, setAdding] = useState(openAddTask);
  const requestTaken = useRef(false);
  useEffect(() => {
    if (!openAddTask || requestTaken.current) return;
    requestTaken.current = true;
    onAddTaskOpened?.();
  }, [openAddTask, onAddTaskOpened]);
  void activitiesLoading;

  if (!task) return null;

  const slugOf = (id: string) =>
    board?.projects.find((p) => p.id === id)?.slug ?? "?";
  const memberOf = (id: string | null, name: string | null) => {
    if (!id) return null;
    const member = board?.members.find((m) => m.id === id);
    return toPerson({
      id,
      name: member?.name ?? name ?? "?",
      image: member?.image ?? null,
    });
  };
  const linked = (r: RelatedTask): LinkedTask => ({
    id: r.id,
    projectId: r.projectId,
    key: `${slugOf(r.projectId)}-${r.number ?? "?"}`,
    title: r.title,
    status: toStatus(r),
    owner: memberOf(r.userId, r.assigneeName),
  });
  const pick = (type: "blocks" | "subtask", side: "source" | "target") =>
    otherEnds(relations, taskId, type, side).map(linked);

  const waitsOn = pick("blocks", "target");
  const blocks = pick("blocks", "source");
  const parent = pick("subtask", "target")[0] ?? null;

  // The board already knows this task's siblings.
  const boardParent = parent
    ? board?.tasks.find((p) => p.id === parent.id)
    : undefined;
  const self = boardParent?.subtasks.find((s) => s.id === taskId);
  const siblings: LinkedTask[] = (boardParent?.subtasks ?? []).map((s) => ({
    id: s.id,
    projectId: s.projectId,
    key: s.key,
    title: s.title,
    status: toStatus(s),
    owner: toPerson(s.assignee),
    blocked: toStatus(s) !== "done" && isBlocked(s),
  }));

  const repo = board?.projects.find((p) => p.id === projectId);
  const status = toStatus({
    status: task.status,
    isCompleted: self?.isCompleted ?? task.status === "done",
  });
  // A feature follows its tasks: its own status is ignored (BOARD.md rule 3).
  const built = board ? buildBoard(board) : null;
  const boardTask = built?.boardTasks.find((x) => x.id === taskId);
  const itemOf = (id: string) =>
    built ? findBoardItem(built.boardTasks, id) : undefined;
  const boardItem = itemOf(taskId);
  const isDone = pageDone({ status, boardItem });
  const blocked = pageBlocked({ status, boardItem, waitsOn });
  const effective = (x: LinkedTask): LinkedTask => {
    const item = itemOf(x.id);
    return item ? { ...x, status: effectiveStatus(item) } : x;
  };
  const waitsOnView = waitsOn.map(effective);
  const blocksView = blocks.map((raw) => {
    const x = effective(raw);
    return {
      ...x,
      blocked: waitingOnThis({
        target: itemOf(x.id),
        taskId,
        fallback: !isDone && x.status !== "done",
      }),
    };
  });
  const followsSubtasks = !!boardTask && boardTask.subtasks.length > 0;
  const isBoardItem = !!boardTask || !!self;

  const bar = deriveStatusBar({
    columns: columns.data,
    status: task.status,
    blocked,
    loading: columns.isLoading,
    failed: columns.isError,
  });
  const openBlockers = waitsOnView.filter((x) => x.status !== "done");
  const pendingRequest = Boolean(task.pendingRequest);
  const owner = memberOf(task.userId, task.assigneeName);
  const released = blocksView.filter(
    (x) => x.status !== "done" && !x.blocked,
  ).length;
  const headline = deriveHeadline({
    bar: followsSubtasks ? "ready" : bar.kind,
    done: isDone,
    openBlockers,
    pendingRequest,
    released,
    owner: owner?.name ?? null,
  });
  const progress =
    bar.kind === "ready" && bar.steps.length > 1
      ? bar.index / (bar.steps.length - 1)
      : 0;
  const column = columns.data?.find(
    (c) => c.slug === task.status || c.id === task.status,
  );
  const label = followsSubtasks
    ? t("tasks:hero.status.followsTasks")
    : bar.kind === "unknown"
      ? t("tasks:hero.status.unknownShort")
      : getStatusDisplayLabel(task.status, column?.name);
  const tone = heroTone({
    unknown: bar.kind === "unknown" && !followsSubtasks,
    done: isDone,
    pendingRequest,
    blocked,
    started: progress > 0,
  });

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pt-6 pb-16 sm:px-6">
      <TaskHero
        tone={tone}
        keyLabel={`${slugOf(projectId)}-${task.number}${boardTask ? ` · ${kindOf(boardTask)}` : ""}`}
        repoName={
          repo?.kind === "repo"
            ? (repo.repository?.split("/")[1] ??
              repo.name.replace(/\s*\(.*\)\s*$/, ""))
            : null
        }
        title={<TaskTitle taskId={taskId} size="md" />}
        headline={
          <TaskHeadline headline={headline} owner={owner?.name ?? null} />
        }
        bar={
          followsSubtasks ? (
            <p className="rounded-xl bg-muted px-3 py-3 text-muted-foreground text-sm">
              {t("tasks:hero.status.followsTasks")}
            </p>
          ) : (
            <TaskStatusBar task={task} blocked={blocked} />
          )
        }
        diagram={
          <TaskDiagram
            waitsOn={waitsOnView}
            blocks={blocksView}
            done={isDone}
            stillNeeded={blocked}
            workspaceId={workspaceId}
            core={
              <DiagramCore
                label={label}
                glyph={isDone ? "done" : status}
                progress={progress}
                tone={tone}
              />
            }
          />
        }
        owner={owner}
        signal={
          pendingRequest
            ? t("tasks:hero.status.requested")
            : blocked && !isDone
              ? t("tasks:hero.signal.blocked")
              : null
        }
      />

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 space-y-8">
          <TaskChangeRequest
            key={taskId}
            taskId={taskId}
            projectId={projectId}
            workspaceId={workspaceId}
          />
          <TaskDescription taskId={taskId} />
          {boardTask && built && (
            <>
              <TaskStream
                feature={boardTask}
                lanes={built.lanes}
                workspaceId={workspaceId}
                onAdd={() => setAdding(true)}
              />
              {adding && (
                <AddSubtaskDialog
                  boardTask={boardTask}
                  lanes={built.lanes}
                  workspaceId={workspaceId}
                  open
                  onOpenChange={(open) => !open && setAdding(false)}
                />
              )}
            </>
          )}
          <TaskActivity taskId={taskId} projectId={projectId} />
        </div>
        <aside
          className="min-w-0 space-y-6"
          aria-label={t("tasks:hero.propertiesLabel")}
        >
          <PropertyChips
            taskId={taskId}
            projectId={projectId}
            workspaceId={workspaceId}
            hideStatus
            hideProject={isBoardItem}
          />
          {siblings.length > 0 && (
            <Siblings
              parent={parent}
              items={siblings}
              currentId={taskId}
              workspaceId={workspaceId}
            />
          )}
          {isBoardItem && built ? (
            <WaitsOnSection
              taskId={taskId}
              workspaceId={workspaceId}
              relations={relations}
              boardTasks={built.boardTasks}
              keyOf={(x) => `${slugOf(x.projectId)}-${x.number ?? "?"}`}
              canAdd={!followsSubtasks}
            />
          ) : board ? (
            <TaskRelations
              taskId={taskId}
              projectId={projectId}
              workspaceId={workspaceId}
            />
          ) : null}
          <ExternalLinksAccordion
            taskId={taskId}
            externalLinks={externalLinks as ExternalLink[]}
            isLoading={linksLoading}
          />
        </aside>
      </div>
    </div>
  );
}
