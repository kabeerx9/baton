import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { canWorkOnTask } from "@/hooks/can-work-on-task";
import CommentInput from "./comment-input";

const permissions = vi.hoisted(() => ({
  updateTasks: true,
  updateAssignedTasks: true,
  assigneeId: "someone" as string | null,
}));
vi.mock("@/hooks/use-workspace-permission", () => ({
  useWorkspacePermission: () => ({
    canWorkOnTask: (assigneeId: string | null) =>
      canWorkOnTask(permissions, "me", assigneeId),
  }),
}));
vi.mock("@/hooks/queries/task/use-task-assignee", () => ({
  default: () => permissions.assigneeId,
}));
vi.mock("@/components/activity/comment-editor", () => ({
  default: ({ placeholder }: { placeholder: string }) => (
    <div role="textbox" aria-label={placeholder} />
  ),
}));
vi.mock("@/hooks/mutations/comment/use-create-comment", () => ({
  default: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
// The real tooltip rejects the disabled submit button in tests; this test
// is about whether the box renders at all.
vi.mock("@/components/ui/tooltip", () => {
  const Pass = ({ children }: { children?: React.ReactNode }) => (
    <>{children}</>
  );
  return {
    Tooltip: Pass,
    TooltipContent: () => null,
    TooltipProvider: Pass,
    TooltipTrigger: Pass,
  };
});
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

afterEach(() => {
  cleanup();
  permissions.updateTasks = true;
  permissions.updateAssignedTasks = true;
  permissions.assigneeId = "someone";
});

const renderInput = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <CommentInput taskId="task-1" projectId="project-1" />
    </QueryClientProvider>,
  );

describe("CommentInput", () => {
  it("shows the comment box to people who can update tasks", () => {
    renderInput();
    expect(
      screen.getByRole("textbox", {
        name: "activity:comment.leavePlaceholder",
      }),
    ).toBeTruthy();
  });

  it("shows a viewer the comment box on a task assigned to them", () => {
    permissions.updateTasks = false;
    permissions.assigneeId = "me";
    renderInput();
    expect(screen.queryByRole("textbox")).not.toBeNull();
  });

  it("shows a viewer no comment box on someone else's task: the API refuses it", () => {
    permissions.updateTasks = false;
    renderInput();
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("shows no comment box without either permission", () => {
    permissions.updateTasks = false;
    permissions.updateAssignedTasks = false;
    permissions.assigneeId = "me";
    renderInput();
    expect(screen.queryByRole("textbox")).toBeNull();
  });
});
