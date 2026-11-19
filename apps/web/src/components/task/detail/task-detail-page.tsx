import { useEffect, useMemo, useRef, useState } from "react";
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
import { withItem } from "@/components/board/merge-item";
import {
  type LinkedTask,
  linkedStatus,
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
import { useGetBoardItem } from "@/hooks/queries/board/use-get-board-item";
import { useOverlaidBoard } from "@/hooks/queries/board/use-overlaid-board";
import { useGetColumns } from "@/hooks/queries/column/use-get-columns";
import useExternalLinks from "@/hooks/queries/external-link/use-external-links";
import useGetTask from "@/hooks/queries/task/use-get-task";
import useGetTaskRelations from "@/hooks/queries/task-relation/use-get-task-relations";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import type { ExternalLink } from "@/types/external-link";
import { DiagramCore } from "./diagram/diagram-core";
import { FeatureHero } from "./feature-status/feature-hero";
import { FeatureLanes } from "./feature-status/feature-lanes";
import { summarizeFeature } from "./feature-status/feature-status";
import { TaskDiagram } from "./diagram/task-diagram";
import { deriveHeadline } from "./headline-model";
import { TaskHeadline } from "./task-headline";
import { heroTone } from "./hero-tone";
import { deriveStatusBar } from "./status-bar/status-bar-model";
import { TaskStatusBar } from "./status-bar/task-status-bar";
import { TaskHero } from "./task-hero";
import { getStatusDisplayLabel } from "@/lib/i18n/domain";
import { useTaskStatusStore } from "@/store/task-status/store";
import { shownStatus } from "@/store/task-status/transition";

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
  // The board leaves out old done work. This read has the feature that holds
  // this task whatever its age, so an old done feature still shows its tasks.
  // Only a task in a feature can be missing from the board, so a task the board
  // lists, or one with no subtask relation, needs no extra round trip.
  const inFeature = relations.some((r) => r.relationType === "subtask");
  const boardLists =
    !!board &&
    board.tasks.some(
      (b) => b.id === taskId || b.subtasks.some((s) => s.id === taskId),
    );
  const { data: item } = useGetBoardItem(
    workspaceId,
    taskId,
    !!board && inFeature && !boardLists,
  );
  const withThisItem = useMemo(
    () => (board ? withItem(board, item?.task) : undefined),
    [board, item],
  );
  const pageBoard = useOverlaidBoard(withThisItem);
  const entry = useTaskStatusStore((s) => s.entries[taskId]);
  const columns = useGetColumns(projectId);
  const { isLoading: activitiesLoading } = useGetActivitiesByTaskId(taskId);
  const { data: externalLinks = [], isLoading: linksLoading } =
    useExternalLinks(taskId);
  // Adding a task under this one is a create: a viewer gets no Add button.
  const canCreate = useWorkspacePermission().canCreateTasks();
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
    status: linkedStatus(r),
    owner: memberOf(r.userId, r.assigneeName),
  });
  const pick = (type: "blocks" | "subtask", side: "source" | "target") =>
    otherEnds(relations, taskId, type, side).map(linked);

  const waitsOn = pick("blocks", "target");
  const blocks = pick("blocks", "source");
  const parent = pick("subtask", "target")[0] ?? null;

  // The board already knows this task's siblings.
  const boardParent = parent
    ? pageBoard?.tasks.find((p) => p.id === parent.id)
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
  // The status shown: the server value, or the target of a write in flight.
  const shown = shownStatus(task, entry);
  const status = toStatus({
    status: shown,
    isCompleted: self?.isCompleted ?? shown === "done",
  });
  // A feature follows its tasks: its own status is ignored (BOARD.md rule 3).
  const built = pageBoard ? buildBoard(pageBoard) : null;
  const boardTask = built?.boardTasks.find((x) => x.id === taskId);
  const itemOf = (id: string) =>
    built ? findBoardItem(built.boardTasks, id) : undefined;
  const boardItem = itemOf(taskId);
  const isDone = pageDone({ status, boardItem });
  const blocked = pageBlocked({ status, boardItem, waitsOn });
  const effective = (x: LinkedTask): LinkedTask => {
    // A board item says its column. A linked task the board does not list
    // already carries the API's open flag (see `linkedStatus`).
    const linkedItem = itemOf(x.id);
    return linkedItem ? { ...x, status: effectiveStatus(linkedItem) } : x;
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
  const feature =
    boardTask && boardTask.subtasks.length > 0 ? boardTask : undefined;
  const followsSubtasks = !!feature;
  const featureSummary =
    feature && built
      ? summarizeFeature(feature, {
          waitsOn: waitsOnView,
          blocks: blocksView,
          boardTasks: built.boardTasks,
          memberName: (id) =>
            board?.members.find((m) => m.id === id)?.name ?? null,
        })
      : undefined;
  const isBoardItem = !!boardTask || !!self;

  const bar = deriveStatusBar({
    columns: columns.data,
    status: shown,
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
    bar: bar.kind,
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
  const keyLabel = `${slugOf(projectId)}-${task.number}${boardTask ? ` · ${kindOf(boardTask)}` : ""}`;
  const repoName =
    repo?.kind === "repo"
      ? (repo.repository?.split("/")[1] ??
        repo.name.replace(/\s*\(.*\)\s*$/, ""))
      : null;
  const column = columns.data?.find((c) => c.slug === shown || c.id === shown);
  const label =
    bar.kind === "unknown"
      ? t("tasks:hero.status.unknownShort")
      : getStatusDisplayLabel(shown, column?.name);
  const tone = heroTone({
    unknown: bar.kind === "unknown",
    done: isDone,
    pendingRequest,
    blocked,
    started: progress > 0,
  });

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pt-6 pb-16 sm:px-6">
      {feature && featureSummary ? (
        <>
          <FeatureHero
            feature={feature}
            summary={featureSummary}
            keyLabel={keyLabel}
            repoName={repoName}
            title={<TaskTitle taskId={taskId} size="md" />}
            owner={owner}
          />
          {featureSummary.connected && (
            <FeatureLanes feature={feature} summary={featureSummary} />
          )}
        </>
      ) : (
        <TaskHero
          tone={tone}
          keyLabel={keyLabel}
          repoName={repoName}
          title={<TaskTitle taskId={taskId} size="md" />}
          headline={
            <TaskHeadline headline={headline} owner={owner?.name ?? null} />
          }
          bar={
            <div data-tour="status-bar">
              <TaskStatusBar task={task} blocked={blocked} />
            </div>
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
      )}

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
                onAdd={canCreate ? () => setAdding(true) : undefined}
              />
              {adding && canCreate && (
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
