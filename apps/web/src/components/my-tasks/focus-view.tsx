import { useMemo, useReducer, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { repoLabel } from "@/components/my-work/repo-label";
import type { AssignedTask } from "@/fetchers/task/get-assigned-tasks";
import { useBoardProjectId } from "@/hooks/queries/board/use-board-project-id";
import { useLocalDay } from "@/hooks/use-local-day";
import { clearedCount, hiddenIds, undoTarget } from "./done-ledger";
import { FocusHeader } from "./focus-header";
import { buildFocusPlan, repoLoad } from "./focus-plan";
import { FocusRail } from "./focus-rail";
import type { LeaveBy } from "./hero-card";
import { HeroDeck } from "./hero-deck";
import { MyTasksEmpty } from "./my-tasks-empty";
import { PeopleStrip } from "./people-strip";
import { INITIAL_QUEUE, queueTransition } from "./queue-order";
import { Rise } from "./rise";
import { finishBlock } from "./task-facts";
import { TaskSection } from "./task-section";
import { useFinishTasks } from "./use-finish-tasks";
import { useMoveTask } from "./use-move-task";
import { useMyTasksShortcuts } from "./use-my-tasks-shortcuts";

/**
 * My tasks as one queue: the task to do next, who waits on me, then the rest
 * by date. It stays mounted while the list is empty, so a finish can still be
 * undone after the last task is gone.
 */
export function FocusView({
  tasks: listed,
  total,
  dataUpdatedAt,
  workspaceId,
}: {
  /** The open tasks as last fetched, and when. */
  tasks: AssignedTask[];
  total: number;
  dataUpdatedAt: number;
  workspaceId: string;
}) {
  const { t } = useTranslation();
  const day = useLocalDay();
  const boardProjectId = useBoardProjectId(workspaceId);
  const [order, send] = useReducer(queueTransition, INITIAL_QUEUE);
  const [askedRepo, setAskedRepo] = useState<string | null>(null);
  const [leaveBy, setLeaveBy] = useState<LeaveBy>("swap");
  const rows = useRef<HTMLDivElement>(null);
  const { ledger, finish, undoLast } = useFinishTasks(listed, dataUpdatedAt);
  const move = useMoveTask();

  // A task being finished leaves at once, before the list agrees.
  const open = useMemo(() => {
    const hidden = hiddenIds(ledger);
    return listed.filter((task) => !hidden.has(task.id));
  }, [listed, ledger]);
  const noRepo = t("workspace:myTasks.noRepo");
  const repoOf = (task: AssignedTask) =>
    repoLabel(
      { id: task.projectId, name: task.projectName },
      boardProjectId,
      noRepo,
    );
  const repos = useMemo(
    () =>
      repoLoad(open).map((repo) => ({
        ...repo,
        name: repoLabel(repo, boardProjectId, noRepo),
      })),
    [open, boardProjectId, noRepo],
  );
  // A repo with nothing left in it stops filtering, so the page never goes blank.
  const repoId = repos.some((r) => r.id === askedRepo) ? askedRepo : null;
  const tasks = useMemo(
    () => (repoId ? open.filter((task) => task.projectId === repoId) : open),
    [open, repoId],
  );
  const plan = useMemo(
    () => buildFocusPlan(tasks, day, order),
    [tasks, day, order],
  );
  const { next } = plan;

  const done = (task: AssignedTask) => {
    setLeaveBy("done");
    void finish(task);
  };
  const skip = (task: AssignedTask) => {
    setLeaveBy("skip");
    send({ type: "skip", id: task.id });
  };
  const focus = (task: AssignedTask) => {
    setLeaveBy("swap");
    send({ type: "pin", id: task.id });
  };
  const find = (id: string) => open.find((task) => task.id === id);

  useMyTasksShortcuts({
    rows,
    hasNext: next !== null,
    canUndo: undoTarget(ledger) !== null,
    onFinishNext: () => next && done(next),
    onSkipNext: () => next && skip(next),
    canFinishRow: (id) => {
      const task = find(id);
      return task !== undefined && finishBlock(task) === null;
    },
    onFinishRow: (id) => {
      const task = find(id);
      if (task) done(task);
    },
    onUndo: undoLast,
  });

  if (open.length === 0) {
    return <MyTasksEmpty cleared={clearedCount(ledger) > 0} />;
  }

  const section = { day, workspaceId, onDone: done, onFocus: focus };
  return (
    <div className="mx-auto grid max-w-[1120px] gap-x-12 gap-y-8 px-6 pt-10 pb-24 lg:grid-cols-[minmax(0,1fr)_264px]">
      <div className="flex min-w-0 flex-col gap-8">
        <Rise>
          <FocusHeader
            day={day}
            plan={plan}
            shown={listed.length}
            total={total}
          />
        </Rise>
        <Rise delay={50}>
          <HeroDeck
            day={day}
            leaveBy={leaveBy}
            onDone={done}
            onFocus={focus}
            onMove={(task, date) => void move(task, date)}
            onSkip={skip}
            plan={plan}
            repoOf={repoOf}
            workspaceId={workspaceId}
          />
        </Rise>
        {plan.people.length > 0 ? (
          <Rise delay={110}>
            <PeopleStrip
              nextId={next?.id ?? null}
              onFocus={focus}
              people={plan.people}
            />
          </Rise>
        ) : null}
        <Rise delay={150}>
          <div className="flex flex-col gap-8" ref={rows}>
            <TaskSection
              {...section}
              tasks={plan.overdue}
              title={t("workspace:myWork.due.overdue")}
              tone="danger"
            />
            <TaskSection
              {...section}
              tasks={plan.today}
              title={t("workspace:myWork.due.today")}
            />
            <TaskSection
              {...section}
              tasks={plan.thisWeek}
              title={t("workspace:myWork.due.thisWeek")}
            />
            <TaskSection
              {...section}
              collapsible
              defaultOpen={false}
              tasks={plan.later}
              title={t("workspace:myWork.due.later")}
            />
            <TaskSection
              {...section}
              collapsible
              tasks={plan.held}
              title={t("workspace:myTasks.heldSection")}
              tone="muted"
            />
          </div>
        </Rise>
      </div>
      <Rise delay={90}>
        <FocusRail
          cleared={clearedCount(ledger)}
          day={day}
          onRepo={setAskedRepo}
          openCount={open.length}
          repoId={repoId}
          repos={repos}
          week={plan.week}
        />
      </Rise>
    </div>
  );
}
