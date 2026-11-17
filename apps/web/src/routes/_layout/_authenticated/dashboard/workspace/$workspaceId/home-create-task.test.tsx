import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vite-plus/test";
import { Route } from "./index";

const nothing = vi.hoisted(() => () => null);

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: object) => ({
    options,
    useParams: () => ({ workspaceId: "w1" }),
  }),
  redirect: vi.fn(),
}));
vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/components/common/workspace-layout", () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("@/components/page-title", () => ({ default: nothing }));
vi.mock("@/components/home/activity-feed", () => ({ ActivityFeed: nothing }));
vi.mock("@/components/home/home-projects", () => ({ HomeProjects: nothing }));
vi.mock("@/components/home/up-next", () => ({ UpNext: nothing }));
vi.mock("@/components/home/week-strip", () => ({ WeekStrip: nothing }));
vi.mock("@/components/shared/modals/create-project-modal", () => ({
  default: nothing,
}));
vi.mock("@/components/board/new-task-dialog", () => ({
  NewTaskDialog: ({
    open,
    workspaceId,
  }: {
    open: boolean;
    workspaceId: string;
  }) => (open ? <p>board dialog for {workspaceId}</p> : null),
}));
vi.mock("@/hooks/queries/project/use-get-projects", () => ({
  default: () => ({ data: [{ id: "p" }] }),
}));
vi.mock("@/hooks/queries/task/use-get-assigned-tasks", () => ({
  default: () => ({ data: undefined, isLoading: false, isError: false }),
}));
vi.mock("@/hooks/use-local-day", () => ({ useLocalDay: () => Date.now() }));
vi.mock("@/hooks/use-workspace-permission", () => ({
  useWorkspacePermission: () => ({
    canCreateTasks: () => true,
    canCreateProjects: () => true,
  }),
}));

describe("home: new task", () => {
  it("opens the board's new task dialog, not the repo task modal", () => {
    const Page = (
      Route as unknown as { options: { component: () => React.ReactNode } }
    ).options.component;
    render(<Page />);
    expect(screen.queryByText(/board dialog/)).toBeNull();
    fireEvent.click(
      screen.getByRole("button", { name: "workspace:home.newTask" }),
    );
    expect(screen.getByText("board dialog for w1")).toBeVisible();
  });
});
