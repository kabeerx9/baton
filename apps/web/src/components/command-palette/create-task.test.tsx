import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import createBoardTask from "@/fetchers/board/create-board-task";
import CommandPalette from "./index";

const m = vi.hoisted(() => ({
  shortcuts: {} as Record<string, () => void>,
  board: [] as { id: string; title: string }[],
}));

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn(),
}));
vi.mock("@/lib/shortcuts/use-shortcut", () => ({
  useShortcut: (id: string, handler: () => void) => {
    m.shortcuts[id] = handler;
  },
}));
vi.mock("@/components/shortcuts/shortcut-keys", () => ({
  ShortcutKeys: () => null,
}));
vi.mock("@/hooks/queries/workspace/use-active-workspace", () => ({
  default: () => ({ data: { id: "w1" } }),
}));
vi.mock("@/hooks/queries/config/use-get-config", () => ({
  default: () => ({ data: undefined }),
}));
vi.mock("@/lib/auth-client", () => ({
  authClient: { useSession: () => ({ data: null }) },
}));
vi.mock("@/components/search-command-menu", () => ({ default: () => null }));
vi.mock("@/components/shared/modals/create-workspace-modal", () => ({
  default: () => null,
}));
vi.mock("../shared/modals/create-project-modal", () => ({
  default: () => null,
}));
vi.mock("@/components/board/assignee-select", () => ({
  AssigneeSelect: () => null,
}));
vi.mock("@/fetchers/board/create-board-task", () => ({ default: vi.fn() }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  m.board = [];
});

/** Stands in for the board page: reads the board query the palette must refresh. */
function BoardProbe() {
  const { data } = useQuery({
    queryKey: ["task-board", "w1"],
    queryFn: async () => [...m.board],
  });
  return (
    <ul>
      {data?.map((task) => (
        <li key={task.id}>{task.title}</li>
      ))}
    </ul>
  );
}

describe("command palette: create task", () => {
  it("opens the board's new task dialog and the task appears on the board", async () => {
    vi.mocked(createBoardTask).mockImplementation(async (input) => {
      const task = { id: "t1", title: input.title ?? "", projectId: "board" };
      m.board.push(task);
      return task as never;
    });
    render(
      <QueryClientProvider client={new QueryClient()}>
        <BoardProbe />
        <CommandPalette />
      </QueryClientProvider>,
    );
    await waitFor(() => expect(screen.queryByRole("listitem")).toBeNull());

    act(() => m.shortcuts.createTask());
    const name = await screen.findByLabelText("What is it");
    fireEvent.change(name, { target: { value: "Fix the login crash" } });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));

    // It goes to the board endpoint, not the repo task route that now refuses.
    await waitFor(() => expect(createBoardTask).toHaveBeenCalledTimes(1));
    expect(vi.mocked(createBoardTask).mock.calls[0]![0]).toMatchObject({
      workspaceId: "w1",
      title: "Fix the login crash",
    });
    expect(await screen.findByText("Fix the login crash")).toBeVisible();
    expect(screen.queryByLabelText("What is it")).toBeNull();
  });
});
