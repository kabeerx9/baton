import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vite-plus/test";
import { PropertyChips } from "./property-chips";

const permission = vi.hoisted(() => ({
  canWorkOnTask: false,
  canAssignTasks: false,
  canLabelTask: false,
}));

vi.mock("@/hooks/use-workspace-permission", () => ({
  useWorkspacePermission: () => ({
    canWorkOnTask: () => permission.canWorkOnTask,
    canAssignTasks: () => permission.canAssignTasks,
    canLabelTask: () => permission.canLabelTask,
  }),
}));

vi.mock("./use-task-properties", () => ({
  useTaskProperties: () => ({
    task: {
      id: "task-1",
      title: "Someone else's task",
      projectId: "project-1",
      userId: "someone-else",
      assigneeName: "Someone Else",
      status: "to-do",
      priority: null,
      startDate: null,
      dueDate: null,
    },
    project: { id: "project-1", name: "App" },
    labels: [],
    status: { slug: "to-do", label: "To do", isFinal: false, icon: null },
    assignee: null,
    dueStatus: "normal",
    canMoveTask: false,
  }),
}));

vi.mock("@/hooks/mutations/task/use-update-task", () => ({
  useUpdateTask: () => ({ mutateAsync: vi.fn() }),
}));
vi.mock("@/hooks/mutations/task/use-update-task-due-date", () => ({
  useUpdateTaskDueDate: () => ({ mutateAsync: vi.fn() }),
}));
vi.mock("@/hooks/mutations/task/use-update-task-status-priority", () => ({
  useUpdateTaskPriority: () => ({ mutateAsync: vi.fn() }),
}));
vi.mock("@/hooks/mutations/task/use-update-task-assignee", () => ({
  useUpdateTaskAssignee: () => ({ mutateAsync: vi.fn() }),
}));
vi.mock("@/hooks/mutations/label/use-attach-label-to-task", () => ({
  default: () => ({ mutateAsync: vi.fn() }),
}));
vi.mock("@/hooks/mutations/label/use-detach-label-from-task", () => ({
  default: () => ({ mutateAsync: vi.fn() }),
}));
vi.mock("@/hooks/mutations/label/use-create-label", () => ({
  default: () => ({ mutateAsync: vi.fn() }),
}));
vi.mock("@/hooks/queries/label/use-get-labels-by-task", () => ({
  default: () => ({ data: [] }),
}));
vi.mock("@/hooks/queries/label/use-get-labels-by-workspace", () => ({
  default: () => ({ data: [] }),
}));
vi.mock("@/hooks/queries/workspace-users/use-get-project-members", () => ({
  default: () => ({ data: [] }),
}));

function renderChips() {
  const client = new QueryClient();
  return render(
    <QueryClientProvider client={client}>
      <PropertyChips
        taskId="task-1"
        projectId="project-1"
        workspaceId="workspace-1"
      />
    </QueryClientProvider>,
  );
}

function chip(container: HTMLElement, action: string) {
  return container.querySelector(`[data-task-action="${action}"]`);
}

const inert = [
  ["priority", "priority"],
  ["dueDate", "due date"],
  ["labels", "labels"],
  ["assignee", "assignee"],
] as const;

describe("PropertyChips for a viewer on someone else's task", () => {
  it("marks the inert controls disabled for assistive tech", () => {
    permission.canWorkOnTask = false;
    permission.canAssignTasks = false;
    permission.canLabelTask = false;
    const { container } = renderChips();

    for (const [action] of inert) {
      expect(chip(container, action)?.getAttribute("aria-disabled")).toBe(
        "true",
      );
    }
    // The start date button has no action marker of its own.
    const start = screen.getByText("Start").closest("button");
    expect(start?.getAttribute("aria-disabled")).toBe("true");
  });

  it("gives the assignee control a non-clickable cursor", () => {
    permission.canWorkOnTask = false;
    permission.canAssignTasks = false;
    permission.canLabelTask = false;
    const { container } = renderChips();

    expect(chip(container, "assignee")?.className).toContain("cursor-default");
  });

  it("leaves the controls enabled for someone who can edit the task", () => {
    permission.canWorkOnTask = true;
    permission.canAssignTasks = true;
    permission.canLabelTask = true;
    const { container } = renderChips();

    for (const [action] of inert) {
      expect(chip(container, action)?.getAttribute("aria-disabled")).toBeNull();
    }
    expect(
      screen
        .getByText("Start")
        .closest("button")
        ?.getAttribute("aria-disabled"),
    ).toBeNull();
  });
});
