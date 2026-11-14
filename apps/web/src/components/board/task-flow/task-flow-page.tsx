import { GitPullRequest } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ExternalLinksAccordion } from "@/components/external-links/external-links-accordion";
import { PropertyChips } from "@/components/task/properties/property-chips";
import { TaskActivity } from "@/components/task/task-activity";
import TaskDescription from "@/components/task/task-description";
import TaskRelations from "@/components/task/task-relations";
import TaskTitle from "@/components/task/task-title";
import { useUpdateTaskAssignee } from "@/hooks/mutations/task/use-update-task-assignee";
import useGetActivitiesByTaskId from "@/hooks/queries/activity/use-get-activities-by-task-id";
import { useGetBoard } from "@/hooks/queries/board/use-get-board";
import useExternalLinks from "@/hooks/queries/external-link/use-external-links";
import useGetTask from "@/hooks/queries/task/use-get-task";
import useGetTaskRelations from "@/hooks/queries/task-relation/use-get-task-relations";
import type { ExternalLink } from "@/types/external-link";
import { AddSubtaskDialog } from "../add-subtask-dialog";
import { AssigneeSelect } from "../assignee-select";
import {
  buildBoard,
  effectiveStatus,
  findBoardItem,
  isBlocked,
  kindOf,
  STATUS_LABEL,
  toPerson,
  toStatus,
} from "../model";
import { StatusIcon } from "../status-icon";
import { Chain } from "./chain";
import { Disclosure } from "./disclosure";
import { type LinkedTask, otherEnds, type RelatedTask } from "./linked";
import { pageBlocked, pageDone, waitingOnThis } from "./page-blocked";
import { Siblings } from "./siblings";
import { StatusSteps } from "./status-steps";
import { TaskStream } from "./task-stream";
import { WaitsOnSection } from "./waits-on-section";

/**
 * The page for one task or subtask. On top, the chain: what it needs first,
 * the task, and who waits on it. Below, the brief and its details. Status and
 * owner show once, in the top card, so the property row leaves them out.
 */
export function TaskFlowPage({
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
  const { data: task } = useGetTask(taskId);
  const { data: relations = [] } = useGetTaskRelations(taskId);
  const { data: board } = useGetBoard(workspaceId);
  const { data: activities = [] } = useGetActivitiesByTaskId(taskId);
  const { data: externalLinks = [], isLoading: linksLoading } =
    useExternalLinks(taskId);
  const assign = useUpdateTaskAssignee();
  const [adding, setAdding] = useState(openAddTask);
  const requestTaken = useRef(false);
  useEffect(() => {
    if (!openAddTask || requestTaken.current) return;
    requestTaken.current = true;
    onAddTaskOpened?.();
  }, [openAddTask, onAddTaskOpened]);

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
  const linked = (t: RelatedTask): LinkedTask => ({
    id: t.id,
    projectId: t.projectId,
    key: `${slugOf(t.projectId)}-${t.number ?? "?"}`,
    title: t.title,
    status: toStatus(t),
    owner: memberOf(t.userId, t.assigneeName),
  });
  const pick = (type: "blocks" | "subtask", side: "source" | "target") =>
    otherEnds(relations, taskId, type, side).map(linked);

  const waitsOn = pick("blocks", "target");
  const blocks = pick("blocks", "source");
  const parent = pick("subtask", "target")[0] ?? null;

  // The board already knows this task's siblings and its pull request.
  const boardParent = parent
    ? board?.tasks.find((t) => t.id === parent.id)
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
  const pr =
    self?.pullRequests.find((p) => p.state === "open") ??
    self?.pullRequests.at(-1);

  const repo = board?.projects.find((p) => p.id === projectId);
  const status = toStatus({
    status: task.status,
    isCompleted: self?.isCompleted ?? task.status === "done",
  });
  const comments = activities.filter((a) => a.type === "comment").length;
  const changes = activities.length - comments;
  // A task on the board itself. Its subtasks are drawn as the map below, and
  // when it has any, its column follows them and its own status is not used.
  const built = board ? buildBoard(board) : null;
  const boardTask = built?.boardTasks.find((t) => t.id === taskId);
  // A board item is blocked by the API's rule. Any other task, or one before
  // the board loads, is judged from its relations, as the API refuses Done there too.
  const itemOf = (id: string) =>
    built ? findBoardItem(built.boardTasks, id) : undefined;
  const boardItem = itemOf(taskId);
  const isDone = pageDone({ status, boardItem });
  const blocked = pageBlocked({ status, boardItem, waitsOn });
  const stillNeeded = blocked;
  // A related feature's stored status is not its state: use its column.
  const effective = (t: LinkedTask): LinkedTask => {
    const item = itemOf(t.id);
    return item ? { ...t, status: effectiveStatus(item) } : t;
  };
  const waitsOnView = waitsOn.map(effective);
  const blocksView = blocks.map((raw) => {
    const t = effective(raw);
    return {
      ...t,
      blocked: waitingOnThis({
        target: itemOf(t.id),
        taskId,
        fallback: !isDone && t.status !== "done",
      }),
    };
  });
  const followsSubtasks = !!boardTask && boardTask.subtasks.length > 0;
  // Anything on the board has its status and owner in the top card. Before the
  // board loads, nothing is known, so the generic parts wait.
  const isBoardItem = !!boardTask || !!self;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pt-6 pb-16 sm:px-6">
      <Chain
        waitsOn={waitsOnView}
        stillNeeded={stillNeeded}
        blocks={blocksView}
        done={isDone}
        workspaceId={workspaceId}
      >
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-foreground">
            {boardTask ? kindOf(boardTask) : "Task"}
          </span>
          <span className="font-mono">
            {slugOf(projectId)}-{task.number}
          </span>
          {repo?.kind === "repo" && (
            <span className="truncate">
              ·{" "}
              {repo.repository?.split("/")[1] ??
                repo.name.replace(/\s*\(.*\)\s*$/, "")}
            </span>
          )}
          {blocked && (
            <span className="ml-auto text-amber-600 dark:text-amber-400">
              Blocked
            </span>
          )}
        </div>
        <div className="mt-1">
          <TaskTitle taskId={taskId} size="md" />
        </div>
        <div className="mt-3">
          {followsSubtasks && boardTask ? (
            <p className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 rounded-lg bg-muted px-2.5 py-2 text-xs">
              <StatusIcon status={boardTask.column} size={13} />
              <span className="whitespace-nowrap">
                {STATUS_LABEL[boardTask.column]}
              </span>
              <span className="whitespace-nowrap text-muted-foreground">
                · follows its tasks
              </span>
            </p>
          ) : (
            <StatusSteps taskId={taskId} status={status} blocked={blocked} />
          )}
        </div>
        <div className="mt-3">
          <AssigneeSelect
            workspaceId={workspaceId}
            value={task.userId ?? undefined}
            onChange={(userId) =>
              assign.mutate({ ...task, userId: userId ?? "" })
            }
          />
        </div>
        {pr && (
          <a
            href={pr.url}
            target="_blank"
            rel="noreferrer"
            className="mt-3 flex items-center gap-2 rounded-lg border border-border px-2.5 py-2 text-xs hover:bg-accent"
          >
            <GitPullRequest className="size-3.5 shrink-0" />
            <span className="flex-1">Pull request #{pr.number}</span>
            <span className="inline-flex items-center gap-1 text-muted-foreground">
              <span
                className={`size-1.5 rounded-full ${pr.state === "merged" ? "bg-violet-500" : pr.state === "open" ? "bg-emerald-500" : "bg-muted-foreground"}`}
              />
              {pr.state}
            </span>
          </a>
        )}
      </Chain>

      {boardTask && built && (
        <div className="mt-6">
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
        </div>
      )}

      <div
        className={`mt-6 grid gap-8 ${siblings.length > 0 ? "md:grid-cols-[220px_minmax(0,1fr)]" : ""}`}
      >
        {siblings.length > 0 && (
          <Siblings
            parent={parent}
            items={siblings}
            currentId={taskId}
            workspaceId={workspaceId}
          />
        )}
        <div
          className={`min-w-0 ${siblings.length > 0 ? "" : "w-full max-w-3xl"}`}
        >
          <TaskDescription taskId={taskId} />

          {/* Always open: these are details people read, not extras. */}
          <section className="mt-6 border-border border-t pt-5">
            <PropertyChips
              taskId={taskId}
              projectId={projectId}
              workspaceId={workspaceId}
              hideStatus={isBoardItem}
              hideAssignee={isBoardItem}
              hideProject={isBoardItem}
            />
            <div className="mt-5 flex flex-col gap-6">
              {isBoardItem && built ? (
                <WaitsOnSection
                  taskId={taskId}
                  workspaceId={workspaceId}
                  relations={relations}
                  boardTasks={built.boardTasks}
                  keyOf={(t) => `${slugOf(t.projectId)}-${t.number ?? "?"}`}
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
            </div>
          </section>

          <div className="mt-8">
            <Disclosure
              title="Activity"
              defaultOpen
              hint={`${comments} ${comments === 1 ? "comment" : "comments"} · ${changes} ${changes === 1 ? "change" : "changes"}`}
            >
              {/* The disclosure already carries the heading. */}
              <TaskActivity
                taskId={taskId}
                projectId={projectId}
                className="[&>h2]:hidden"
              />
            </Disclosure>
          </div>
        </div>
      </div>
    </div>
  );
}
