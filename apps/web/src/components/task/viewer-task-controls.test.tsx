import { cleanup, render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { Button } from "@/components/ui/button";
import { canWorkOnTask } from "@/hooks/can-work-on-task";
import type Task from "@/types/task";
import TaskDueDatePopover from "./task-due-date-popover";
import TaskLabelsPopover from "./task-labels-popover";
import TaskPriorityPopover from "./task-priority-popover";
import TaskStatusPopover from "./task-status-popover";

// A viewer (task:update_assigned only) gets the task controls on a task
// assigned to them, and plain read-only content on anyone else's.

const VIEWER = "viewer-1";
const can = vi.hoisted(() => ({
  updateTasks: false,
  updateAssignedTasks: true,
  updateLabels: false,
}));

vi.mock("@/hooks/use-workspace-permission", () => ({
  useWorkspacePermission: () => ({
    canWorkOnTask: (assigneeId: string | null) =>
      canWorkOnTask(can, VIEWER, assigneeId),
    canLabelTask: (assigneeId: string | null) =>
      can.updateLabels ||
      canWorkOnTask({ ...can, updateTasks: false }, VIEWER, assigneeId),
  }),
}));
vi.mock("@/hooks/queries/column/use-get-columns", () => ({
  useGetColumns: () => ({ data: [], isLoading: false, isError: false }),
}));
vi.mock("@/hooks/mutations/task/use-update-task-status", () => ({
  useUpdateTaskStatus: () => ({ mutateAsync: vi.fn() }),
}));
vi.mock("@/hooks/mutations/task/use-update-task-status-priority", () => ({
  useUpdateTaskPriority: () => ({ mutateAsync: vi.fn() }),
}));
vi.mock("@/hooks/mutations/task/use-update-task-due-date", () => ({
  useUpdateTaskDueDate: () => ({ mutateAsync: vi.fn() }),
}));
vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: (key: string) => key }),
}));

afterEach(cleanup);

function taskFor(assigneeId: string | null): Task {
  return {
    id: "task-1",
    title: "A task",
    number: 1,
    description: null,
    status: "to-do",
    priority: null,
    startDate: null,
    dueDate: null,
    position: 1,
    createdAt: "2026-11-19T00:00:00.000Z",
    userId: assigneeId,
    assigneeId,
    assigneeName: null,
    projectId: "project-1",
    statusChange: { move: assigneeId === VIEWER ? "apply" : "deny" },
  } as Task;
}

const controls: Record<string, (task: Task) => ReactElement> = {
  status: (task) => (
    <TaskStatusPopover task={task}>
      <Button>Control</Button>
    </TaskStatusPopover>
  ),
  priority: (task) => (
    <TaskPriorityPopover task={task}>
      <Button>Control</Button>
    </TaskPriorityPopover>
  ),
  dueDate: (task) => (
    <TaskDueDatePopover task={task}>
      <Button>Control</Button>
    </TaskDueDatePopover>
  ),
  labels: (task) => (
    <TaskLabelsPopover task={task} workspaceId="workspace-1">
      <Button>Control</Button>
    </TaskLabelsPopover>
  ),
};

/** A popover trigger carries aria-expanded; plain content does not. */
function isControl() {
  return screen
    .getByRole("button", { name: "Control" })
    .hasAttribute("aria-expanded");
}

describe("task controls for a viewer", () => {
  for (const [name, renderControl] of Object.entries(controls)) {
    it(`${name}: a control on the viewer's own task`, () => {
      render(renderControl(taskFor(VIEWER)));
      expect(isControl()).toBe(true);
    });

    it(`${name}: read-only on someone else's task`, () => {
      render(renderControl(taskFor("someone-else")));
      expect(isControl()).toBe(false);
    });

    it(`${name}: read-only on an unassigned task`, () => {
      render(renderControl(taskFor(null)));
      expect(isControl()).toBe(false);
    });
  }
});
