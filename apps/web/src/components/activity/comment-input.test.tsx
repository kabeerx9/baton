import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import CommentInput from "./comment-input";

const permissions = vi.hoisted(() => ({ canUpdateTasks: true }));
vi.mock("@/hooks/use-workspace-permission", () => ({
  useWorkspacePermission: () => ({
    canUpdateTasks: () => permissions.canUpdateTasks,
  }),
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
  permissions.canUpdateTasks = true;
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

  it("shows a viewer no comment box: the API refuses their comment", () => {
    permissions.canUpdateTasks = false;
    renderInput();
    expect(screen.queryByRole("textbox")).toBeNull();
  });
});
